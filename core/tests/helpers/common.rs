//! Common integration test helpers

use anyhow::Context;
use chrono::Utc;
use sd_core::{
	config::{AppConfig, JobLoggingConfig, LogStreamConfig, LoggingConfig, Preferences, ServiceConfig},
	infra::{
		db::entities,
		job::JobStatus,
	},
	library::Library,
};
use sea_orm::{ActiveValue::Set, EntityTrait, PaginatorTrait};
use std::{
	path::{Path, PathBuf},
	sync::Arc,
	time::Duration,
};
use uuid::Uuid;

/// Initialize tracing subscriber for tests, writing to a log file in the snapshot directory
pub fn init_test_tracing(_test_name: &str, snapshot_dir: &Path) -> anyhow::Result<()> {
	use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

	let log_file = std::fs::File::create(snapshot_dir.join("test.log"))?;

	let _ = tracing_subscriber::registry()
		.with(
			fmt::layer()
				.with_target(true)
				.with_thread_ids(true)
				.with_ansi(false)
				.with_writer(log_file),
		)
		.with(fmt::layer().with_target(true).with_thread_ids(true))
		.with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
			EnvFilter::new("sd_core=debug,helpers=trace")
		}))
		.try_init();

	Ok(())
}

/// Builder for creating test AppConfig
pub struct TestConfigBuilder {
	data_dir: PathBuf,
	sync_log_filter: String,
}

impl TestConfigBuilder {
	pub fn new(data_dir: PathBuf) -> Self {
		Self {
			data_dir,
			sync_log_filter: "sd_core::infra::db::entities::entry=debug,\
				sd_core::infra::db::entities::device=debug,\
				sd_core::infra::db::entities::location=debug"
				.to_string(),
		}
	}

	#[allow(dead_code)]
	pub fn with_sync_filter(mut self, filter: impl Into<String>) -> Self {
		self.sync_log_filter = filter.into();
		self
	}

	pub fn build(self) -> anyhow::Result<AppConfig> {
		let logging_config = LoggingConfig {
			main_filter: "sd_core=info".to_string(),
			streams: vec![LogStreamConfig {
				name: "test".to_string(),
				file_name: "test.log".to_string(),
				filter: self.sync_log_filter,
				enabled: true,
			}],
		};

		let config = AppConfig {
			version: 4,
			logging: logging_config,
			data_dir: self.data_dir.clone(),
			log_level: "debug".to_string(),
			telemetry_enabled: false,
			preferences: Preferences::default(),
			job_logging: JobLoggingConfig::default(),
			services: ServiceConfig {
				volume_monitoring_enabled: false,
				fs_watcher_enabled: false,
				statistics_listener_enabled: false,
			},
		};

		// Ensure directories exist
		std::fs::create_dir_all(&self.data_dir)?;
		let config_path = self.data_dir.join("config.toml");
		let toml_str = toml::to_string_pretty(&config)?;
		std::fs::write(&config_path, toml_str)?;

		Ok(config)
	}
}

/// Register a mock device in a test library
pub async fn register_device(
	library: &Arc<Library>,
	device_id: Uuid,
	device_name: &str,
) -> anyhow::Result<()> {
	let device_model = entities::device::ActiveModel {
		id: sea_orm::ActiveValue::NotSet,
		uuid: Set(device_id),
		name: Set(device_name.to_string()),
		slug: Set(device_name.to_lowercase()),
		os: Set("Test OS".to_string()),
		os_version: Set(Some("1.0".to_string())),
		hardware_model: Set(None),
		cpu_model: Set(None),
		cpu_architecture: Set(None),
		cpu_cores_physical: Set(None),
		cpu_cores_logical: Set(None),
		cpu_frequency_mhz: Set(None),
		memory_total_bytes: Set(None),
		form_factor: Set(None),
		manufacturer: Set(None),
		gpu_models: Set(None),
		boot_disk_type: Set(None),
		boot_disk_capacity_bytes: Set(None),
		swap_total_bytes: Set(None),
		network_addresses: Set(serde_json::json!([])),
		is_online: Set(false),
		last_seen_at: Set(Utc::now()),
		capabilities: Set(serde_json::json!({})),
		created_at: Set(Utc::now()),
		updated_at: Set(Utc::now()),
		sync_enabled: Set(true),
	};

	entities::device::Entity::insert(device_model)
		.exec(library.db().conn())
		.await
		.context("Failed to insert test device")?;

	Ok(())
}

/// Wait for indexing jobs to complete and entry count to stabilize
pub async fn wait_for_indexing(
	library: &Arc<Library>,
	_location_id: i32,
	timeout: Duration,
) -> anyhow::Result<()> {
	let start_time = tokio::time::Instant::now();
	let mut job_seen = false;
	let mut last_entry_count = 0;
	let mut stable_iterations = 0;

	loop {
		let running_jobs = library.jobs().list_jobs(Some(JobStatus::Running)).await?;

		if !running_jobs.is_empty() {
			job_seen = true;
			tracing::debug!(
				running_count = running_jobs.len(),
				"Indexing jobs still running"
			);
		}

		let current_entries = entities::entry::Entity::find()
			.count(library.db().conn())
			.await?;

		let completed_jobs = library.jobs().list_jobs(Some(JobStatus::Completed)).await?;

		if !completed_jobs.is_empty() {
			job_seen = true;
		}

		if job_seen && !completed_jobs.is_empty() && running_jobs.is_empty() && current_entries > 0 {
			if current_entries == last_entry_count {
				stable_iterations += 1;
				if stable_iterations >= 3 {
					tracing::info!(
						total_entries = current_entries,
						"Indexing completed and stabilized"
					);
					return Ok(());
				}
			} else {
				stable_iterations = 0;
				last_entry_count = current_entries;
			}
		}

		if start_time.elapsed() > timeout {
			anyhow::bail!(
				"Timeout waiting for indexing to complete after {:?}",
				timeout
			);
		}

		tokio::time::sleep(Duration::from_millis(100)).await;
	}
}
