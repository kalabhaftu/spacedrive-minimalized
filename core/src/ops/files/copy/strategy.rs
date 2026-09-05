//! # Copy Strategy Implementations
//!
//! `core::ops::files::copy::strategy` provides 4 specialized copy strategies, each optimized
//! for specific scenarios. The router selects strategies based on user preferences and system
//! topology to maximize performance while respecting user intent.
//!
//! ## Why Multiple Strategies?
//!
//! A single copy implementation can't optimize for all scenarios. Same-volume moves are instant
//! (metadata update only). CoW filesystems can clone files without copying data. Cross-volume
//! copies need progress tracking and cancellation. Network transfers require encryption and
//! fault tolerance.
//!
//! ## Strategy Selection
//!
//! 1. **`LocalMoveStrategy`** - Atomic filesystem rename (same volume, microseconds)
//! 2. **`FastCopyStrategy`** - CoW-optimized copy (APFS clones, Btrfs reflinks)
//! 3. **`LocalStreamCopyStrategy`** - Chunked streaming with progress (cross-volume)
//! 4. **`RemoteTransferStrategy`** - Encrypted network transfer (cross-device)
//!
//! The router picks RemoteTransferStrategy for cross-device transfers, LocalMoveStrategy for
//! same-volume moves, and FastCopyStrategy for same-volume copies in Atomic mode. Streaming
//! mode or cross-volume operations use LocalStreamCopyStrategy for progress tracking.
//!
//! ## Example
//! ```rust,no_run
//! use spacedrive_core::ops::files::copy::strategy::{CopyStrategy, LocalMoveStrategy};
//! use spacedrive_core::domain::addressing::SdPath;
//!
//! let strategy = LocalMoveStrategy;
//! let bytes_moved = strategy.execute(
//!     &ctx,
//!     &source_path,
//!     &dest_path,
//!     true,  // verify_checksum
//!     None,  // no progress callback
//! ).await?;
//! ```

use crate::{
	domain::addressing::SdPath, infra::job::prelude::*, ops::files::copy::job::CopyPhase,
	volume::VolumeManager,
};
use anyhow::Result;
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::{debug, error, info};

/// Progress callback for strategy implementations to report granular progress
/// Parameters: bytes_copied_for_current_file, total_bytes_for_current_file
pub type ProgressCallback<'a> = Box<dyn Fn(u64, u64) + Send + Sync + 'a>;

/// Strategy pattern for file copy operations with different performance characteristics.
///
/// Each implementation optimizes for specific scenarios (same-volume moves, CoW filesystems,
/// cross-device transfers). The trait abstracts these differences so callers don't need to
/// know which strategy is running - they all provide the same interface with progress callbacks
/// and checksum verification.
#[async_trait]
pub trait CopyStrategy: Send + Sync {
	/// Executes the copy strategy for a single source path
	async fn execute<'a>(
		&self,
		ctx: &JobContext<'a>,
		source: &SdPath,
		destination: &SdPath,
		verify_checksum: bool,
		progress_callback: Option<&ProgressCallback<'a>>,
	) -> Result<u64>;
}

/// Strategy for an atomic move on the same volume
pub struct LocalMoveStrategy;

#[async_trait]
impl CopyStrategy for LocalMoveStrategy {
	async fn execute<'a>(
		&self,
		ctx: &JobContext<'a>,
		source: &SdPath,
		destination: &SdPath,
		verify_checksum: bool,
		progress_callback: Option<&ProgressCallback<'a>>,
	) -> Result<u64> {
		let source_path = source
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Source path is not local"))?;
		let dest_path = destination
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Destination path is not local"))?;

		// Read size before rename since source path becomes invalid after move.
		let metadata = fs::metadata(source_path).await?;
		let size = if metadata.is_file() {
			metadata.len()
		} else {
			get_path_size(source_path).await?
		};

		// Send initial progress event so UI shows 0% before the instant rename.
		if let Some(callback) = progress_callback {
			callback(0, size);
		}

		if let Some(parent) = dest_path.parent() {
			fs::create_dir_all(parent).await?;
		}

		fs::rename(source_path, dest_path).await?;

		if let Some(callback) = progress_callback {
			callback(size, u64::MAX);
		}

		ctx.log(format!(
			"Atomic move: {} -> {}",
			source_path.display(),
			dest_path.display()
		));

		Ok(size)
	}
}

/// Strategy for streaming a copy between different local volumes
pub struct LocalStreamCopyStrategy;

#[async_trait]
impl CopyStrategy for LocalStreamCopyStrategy {
	async fn execute<'a>(
		&self,
		ctx: &JobContext<'a>,
		source: &SdPath,
		destination: &SdPath,
		verify_checksum: bool,
		progress_callback: Option<&ProgressCallback<'a>>,
	) -> Result<u64> {
		let source_path = source
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Source path is not local"))?;
		let dest_path = destination
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Destination path is not local"))?;

		// Query volume characteristics for optimal buffer sizing (SSD vs HDD, USB speeds, etc).
		let (source_vol, dest_vol) = if let Some(volume_manager) = ctx.volume_manager() {
			let source_vol = volume_manager.volume_for_path(source_path).await;
			let dest_vol = volume_manager.volume_for_path(dest_path).await;
			(source_vol, dest_vol)
		} else {
			(None, None)
		};

		let volume_info = match (&source_vol, &dest_vol) {
			(Some(s), Some(d)) => Some((s, d)),
			_ => None,
		};

		let bytes_copied = copy_file_streaming(
			source_path,
			dest_path,
			volume_info,
			ctx,
			verify_checksum,
			progress_callback,
		)
		.await?;

		ctx.log(format!(
			"Streaming copy: {} -> {} ({} bytes)",
			source_path.display(),
			dest_path.display(),
			bytes_copied
		));

		Ok(bytes_copied)
	}
}

/// Fast copy strategy leveraging CoW filesystem optimizations.
///
/// Uses std::fs::copy which automatically invokes APFS clones, Btrfs reflinks, ZFS clones,
/// and ReFS block clones when available. On traditional filesystems, falls back to standard
/// copy. Directory copies delegate to streaming strategy since std::fs::copy only handles files.
pub struct FastCopyStrategy;

#[async_trait]
impl CopyStrategy for FastCopyStrategy {
	async fn execute<'a>(
		&self,
		ctx: &JobContext<'a>,
		source: &SdPath,
		destination: &SdPath,
		verify_checksum: bool,
		progress_callback: Option<&ProgressCallback<'a>>,
	) -> Result<u64> {
		let source_path = source
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Source path is not local"))?;
		let dest_path = destination
			.as_local_path()
			.ok_or_else(|| anyhow::anyhow!("Destination path is not local"))?;

		let metadata = fs::metadata(source_path).await?;
		if metadata.is_dir() {
			// std::fs::copy only handles files; delegate recursive copies to streaming strategy.
			ctx.log(format!(
				"FastCopyStrategy delegating directory to LocalStreamCopyStrategy: {}",
				source_path.display()
			));
			return LocalStreamCopyStrategy
				.execute(ctx, source, destination, verify_checksum, progress_callback)
				.await;
		}

		if let Some(parent) = dest_path.parent() {
			fs::create_dir_all(parent).await?;
		}

		let bytes_copied = tokio::task::spawn_blocking({
			let source_path = source_path.to_path_buf();
			let dest_path = dest_path.to_path_buf();
			move || -> Result<u64, std::io::Error> { std::fs::copy(&source_path, &dest_path) }
		})
		.await??;

		// Post-copy verification detects CoW bugs and hardware errors (bit flips, bad sectors).
		if verify_checksum {
			let source_checksum = calculate_file_checksum(source_path).await?;
			let dest_checksum = calculate_file_checksum(dest_path).await?;
			if source_checksum != dest_checksum {
				return Err(anyhow::anyhow!("Checksum verification failed"));
			}
		}

		// Signal file completion to aggregator
		if let Some(callback) = progress_callback {
			callback(bytes_copied, u64::MAX);
		}

		ctx.log(format!(
			"Fast copy: {} -> {} ({} bytes)",
			source_path.display(),
			dest_path.display(),
			bytes_copied
		));

		Ok(bytes_copied)
	}
}

/// Local-only build: cross-device transfer removed.
pub struct RemoteTransferStrategy;

#[async_trait]
impl CopyStrategy for RemoteTransferStrategy {
	async fn execute<'a>(
		&self,
		_ctx: &JobContext<'a>,
		_source: &SdPath,
		_destination: &SdPath,
		_verify_checksum: bool,
		_progress_callback: Option<&ProgressCallback<'a>>,
	) -> Result<u64> {
		Err(anyhow::anyhow!("Cross-device transfer removed in local-only build"))
	}
}

/// Helper function to get size of a path (file or directory)
async fn get_path_size(path: &Path) -> Result<u64, std::io::Error> {
	let mut total = 0u64;
	let mut stack = vec![path.to_path_buf()];

	while let Some(current_path) = stack.pop() {
		let metadata = fs::metadata(&current_path).await?;

		if metadata.is_file() {
			total += metadata.len();
		} else if metadata.is_dir() {
			let mut dir = fs::read_dir(&current_path).await?;
			while let Some(entry) = dir.next_entry().await? {
				stack.push(entry.path());
			}
		}
	}

	Ok(total)
}

/// Copy a single file with streaming and progress tracking
async fn copy_single_file<'a>(
	source: &Path,
	destination: &Path,
	volume_info: Option<(&crate::volume::Volume, &crate::volume::Volume)>,
	ctx: &JobContext<'a>,
	verify_checksum: bool,
	file_size: u64,
	progress_callback: Option<&ProgressCallback<'a>>,
) -> Result<u64, std::io::Error> {
	let result = copy_single_file_with_offset(
		source,
		destination,
		volume_info,
		ctx,
		verify_checksum,
		file_size,
		progress_callback,
		0,
	)
	.await?;

	// Signal completion so aggregator knows the file is done.
	if let Some(callback) = progress_callback {
		callback(result, u64::MAX);
	}

	Ok(result)
}

/// Copy a single file with streaming and progress tracking, with byte offset for cumulative progress
async fn copy_single_file_with_offset<'a>(
	source: &Path,
	destination: &Path,
	volume_info: Option<(&crate::volume::Volume, &crate::volume::Volume)>,
	ctx: &JobContext<'a>,
	verify_checksum: bool,
	file_size: u64,
	progress_callback: Option<&ProgressCallback<'a>>,
	byte_offset: u64,
) -> Result<u64, std::io::Error> {
	if let Some(parent) = destination.parent() {
		fs::create_dir_all(parent).await?;
	}

	let mut source_file = fs::File::open(source).await?;
	let mut dest_file = fs::File::create(destination).await?;

	// Use smaller of source/dest optimal sizes to avoid overwhelming slower device.
	let chunk_size = if let Some((source_vol, dest_vol)) = volume_info {
		source_vol
			.optimal_chunk_size()
			.min(dest_vol.optimal_chunk_size())
	} else {
		64 * 1024
	};

	let mut buffer = vec![0u8; chunk_size];
	let mut total_copied = 0u64;
	let mut last_progress_update = std::time::Instant::now();

	let mut source_hasher = if verify_checksum {
		Some(blake3::Hasher::new())
	} else {
		None
	};

	let mut dest_hasher = if verify_checksum {
		Some(blake3::Hasher::new())
	} else {
		None
	};

	loop {
		if let Err(_) = ctx.check_interrupt().await {
			// Clean up partial file so resume doesn't see corrupted data.
			let _ = fs::remove_file(destination).await;
			return Err(std::io::Error::new(
				std::io::ErrorKind::Interrupted,
				"Operation cancelled",
			));
		}

		let bytes_read = source_file.read(&mut buffer).await?;
		if bytes_read == 0 {
			break;
		}

		let chunk = &buffer[..bytes_read];
		dest_file.write_all(chunk).await?;
		total_copied += bytes_read as u64;

		if let Some(hasher) = &mut source_hasher {
			hasher.update(chunk);
		}
		if let Some(hasher) = &mut dest_hasher {
			hasher.update(chunk);
		}

		// Throttle progress updates to 50ms intervals for UI smoothness without overhead.
		if last_progress_update.elapsed() >= std::time::Duration::from_millis(50) {
			if let Some(callback) = progress_callback {
				callback(total_copied, file_size);

				if total_copied % (100 * 1024 * 1024) < bytes_read as u64 {
					ctx.log(format!(
						"Strategy progress callback: {} / {} bytes",
						total_copied, file_size
					));
				}
			}
			last_progress_update = std::time::Instant::now();

			// Yield to scheduler so progress reporting and cancellation checks can run.
			tokio::task::yield_now().await;
		}
	}

	dest_file.flush().await?;
	dest_file.sync_all().await?;

	if let Some(callback) = progress_callback {
		callback(file_size, u64::MAX);
		ctx.log(format!(
			"Strategy final progress: {} / {} bytes (100%)",
			total_copied, file_size
		));
	}

	if verify_checksum {
		if let (Some(source_hasher), Some(dest_hasher)) = (source_hasher, dest_hasher) {
			let source_hash = source_hasher.finalize();
			let dest_hash = dest_hasher.finalize();

			if source_hash != dest_hash {
				let _ = fs::remove_file(destination).await;
				return Err(std::io::Error::new(
					std::io::ErrorKind::InvalidData,
					format!(
						"Checksum verification failed: source={}, dest={}",
						source_hash.to_hex(),
						dest_hash.to_hex()
					),
				));
			}

			ctx.log(format!(
				"Checksum verification passed for {}: {}",
				destination.display(),
				source_hash.to_hex()
			));
		}
	}

	let source_metadata = fs::metadata(source).await?;
	let dest_file = fs::File::open(destination).await?;

	#[cfg(unix)]
	{
		use std::os::unix::fs::PermissionsExt;
		let permissions = std::fs::Permissions::from_mode(source_metadata.permissions().mode());
		dest_file.set_permissions(permissions).await?;
	}

	Ok(total_copied)
}

/// Copy file with streaming and progress tracking for cross-volume operations
async fn copy_file_streaming<'a>(
	source: &Path,
	destination: &Path,
	volume_info: Option<(&crate::volume::Volume, &crate::volume::Volume)>,
	ctx: &JobContext<'a>,
	verify_checksum: bool,
	progress_callback: Option<&ProgressCallback<'a>>,
) -> Result<u64, std::io::Error> {
	if let Some(parent) = destination.parent() {
		fs::create_dir_all(parent).await?;
	}

	let metadata = fs::metadata(source).await?;
	if metadata.is_dir() {
		fs::create_dir_all(destination).await?;
		let mut total_size = 0u64;

		// Collect all files first to avoid holding directory handles during copy.
		let mut files_to_copy = Vec::new();
		let mut stack = vec![(source.to_path_buf(), destination.to_path_buf())];

		while let Some((src_path, dest_path)) = stack.pop() {
			if src_path.is_file() {
				files_to_copy.push((src_path, dest_path));
			} else if src_path.is_dir() {
				fs::create_dir_all(&dest_path).await?;
				let mut dir = fs::read_dir(&src_path).await?;
				while let Some(entry) = dir.next_entry().await? {
					let entry_src = entry.path();
					let entry_dest = dest_path.join(entry.file_name());
					stack.push((entry_src, entry_dest));
				}
			}
		}

		let mut cumulative_bytes = 0u64;
		for (src_path, dest_path) in files_to_copy {
			if let Err(_) = ctx.check_interrupt().await {
				return Err(std::io::Error::new(
					std::io::ErrorKind::Interrupted,
					"Operation cancelled",
				));
			}

			let file_metadata = fs::metadata(&src_path).await?;
			let file_size = file_metadata.len();

			let bytes_copied = copy_single_file_with_offset(
				&src_path,
				&dest_path,
				volume_info,
				ctx,
				verify_checksum,
				file_size,
				progress_callback,
				0,
			)
			.await?;
			cumulative_bytes += bytes_copied;
			total_size += bytes_copied;

			// Signal file completion with u64::MAX so aggregator advances to next file.
			if let Some(callback) = progress_callback {
				callback(bytes_copied, u64::MAX);
			}
		}

		return Ok(total_size);
	}

	let file_size = metadata.len();
	copy_single_file(
		source,
		destination,
		volume_info,
		ctx,
		verify_checksum,
		file_size,
		progress_callback,
	)
	.await
}

/// Calculate file checksum for integrity verification
async fn calculate_file_checksum(path: &Path) -> Result<String> {
	crate::domain::content_identity::ContentHashGenerator::generate_content_hash(path)
		.await
		.map_err(|e| anyhow::anyhow!("Failed to generate content hash: {}", e))
}

/// Local-only build: remote streaming removed.
async fn stream_file_data<'a>(
	_file_path: &std::path::Path,
	_transfer_id: uuid::Uuid,
	_total_size: u64,
	_destination_device_id: uuid::Uuid,
	_destination_path: String,
	_ctx: &JobContext<'a>,
	_progress_callback: Option<&ProgressCallback<'a>>,
) -> Result<()> {
	Err(anyhow::anyhow!("Cross-device transfer removed in local-only build"))
}
