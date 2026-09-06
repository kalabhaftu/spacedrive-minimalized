//! Media processing operations
//!
//! This module contains jobs for processing media files including:
//! - Thumbnail generation
//! - Video transcoding
//! - Audio metadata extraction
//! - Image optimization
//! - Blurhash generation for image placeholders

pub mod blurhash;
pub mod metadata_extractor;
pub mod proxy;

pub mod thumbnail;
pub mod thumbstrip;

pub use metadata_extractor::{extract_image_metadata, extract_image_metadata_with_blurhash};

#[cfg(feature = "ffmpeg")]
pub use metadata_extractor::{
	extract_audio_metadata, extract_video_metadata, extract_video_metadata_with_blurhash,
};
pub use proxy::{ProxyJob, ProxyProcessor};
#[cfg(feature = "ffmpeg")]
pub use thumbnail::ThumbnailJob;
#[cfg(feature = "ffmpeg")]
pub use thumbstrip::{ThumbstripJob, ThumbstripProcessor};
