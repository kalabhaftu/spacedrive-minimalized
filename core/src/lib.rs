#![allow(warnings)]
//! Spacedrive Core v2
//!
//! A Virtual Distributed File System (VDFS) implementation in Rust.

pub mod client;
pub mod common;
pub mod config;
pub mod context;
pub mod crypto;
pub mod device;
pub mod domain;
pub mod filetype;
pub mod infra;
pub mod library;
pub mod location;
pub mod ops;
pub mod service;
pub mod testing;
pub mod volume;

use crate::{
	config::AppConfig,
	context::CoreContext,
	device::DeviceManager,
	infra::{
		action::{builder::ActionBuilder, manager::ActionManager, CoreAction, LibraryAction},
		api::ApiDispatcher,
		event::{log_emitter::LogBus, Event, EventBus},
		query::QueryManager,
	},
	library::LibraryManager,
	service::session::SessionStateService,
	service::Services,
	volume::{VolumeDetectionConfig, VolumeManager},
};

use std::{path::PathBuf, sync::Arc};
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info, warn};
use uuid::Uuid;

/// The main context for all core operations
#[derive(Clone)]
pub struct Core {
	/// Application configuration
	pub config: Arc<RwLock<AppConfig>>,

	/// Device manager
	pub device: Arc<DeviceManager>,

	/// Library manager
	pub libraries: Arc<LibraryManager>,

	/// Volume manager
	pub volumes: Arc<VolumeManager>,

	/// Event bus for state changes
	pub events: Arc<EventBus>,

	/// Dedicated log streaming bus (separate from events to avoid overhead)
	pub logs: Arc<LogBus>,

	/// Container for high-level services
	pub services: Services,

	/// Shared context for core components
	pub context: Arc<CoreContext>,

	/// Unified API dispatcher for enhanced operations
	api_dispatcher: ApiDispatcher,
}

impl Core {
	/// Initialize a new Core instance with custom data directory
	pub async fn new(data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
		Self::new_with_config(data_dir, None, None).await
	}

	/// Initialize a new Core instance
	///
	pub async fn new_with_config(
		data_dir: PathBuf,
		config: Option<AppConfig>,
		system_device_name: Option<String>,
	) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
		info!("Initializing Spacedrive at {:?}", data_dir);

		// Load or create app config
		let config = match config {
			Some(c) => c,
			None => AppConfig::load_or_create(&data_dir)?,
		};

		config.ensure_directories()?;

		let config = Arc::new(RwLock::new(config));

		// Initialize unified key manager with file fallback
		let device_key_fallback = data_dir.join("device_key");
		let key_manager = Arc::new(crate::crypto::key_manager::KeyManager::new_with_fallback(
			data_dir.clone(),
			Some(device_key_fallback),
		)?);

		// Initialize device manager
		let device = Arc::new(DeviceManager::init(
			&data_dir,
			key_manager.clone(),
			system_device_name,
		)?);

		// Set a global device ID and slug for convenience
		crate::device::set_current_device_id(device.device_id()?);
		crate::device::set_current_device_slug(device.config()?.slug);

		// Create event bus
		let events = Arc::new(EventBus::default());

		// Create dedicated log bus (separate from events to avoid overhead)
		let logs = Arc::new(LogBus::default());

		// Initialize volume manager
		let volume_config = VolumeDetectionConfig::default();
		let device_id = device.device_id()?;
		let volumes = Arc::new(VolumeManager::new(device_id, volume_config, events.clone()));

		// Initialize volume detection (if enabled)
		let config_read = config.read().await;
		if config_read.services.volume_monitoring_enabled {
			info!("Initializing volume detection...");
			match volumes.initialize().await {
				Ok(()) => info!("Volume manager initialized"),
				Err(e) => error!("Failed to initialize volume manager: {}", e),
			}
		} else {
			info!("Volume monitoring disabled in configuration");
		}
		drop(config_read);

		// Create the context that will be shared with services
		let mut context_inner = CoreContext::new(
			events.clone(),
			device.clone(),
			None, // Libraries will be set after context creation
			volumes.clone(),
			key_manager.clone(),
			data_dir.clone(),
		);

		// Enable per-job file logging by default
		let mut app_config = config.write().await;
		if !app_config.job_logging.enabled {
			app_config.job_logging.enabled = true;
		}
		// Job logs are now stored per-library, not globally
		context_inner.set_job_logging(app_config.job_logging.clone(), None);
		drop(app_config);

		// Create the shared context
		let context = Arc::new(context_inner);

		// Initialize library manager with libraries directory and context
		let libraries_dir = config.read().await.libraries_dir();
		let libraries = Arc::new(LibraryManager::new_with_dir(
			libraries_dir,
			events.clone(),
			volumes.clone(),
			device.clone(),
		));

		// Update context with libraries
		context.set_libraries(libraries.clone()).await;

		// Initialize services first, passing them the context
		let mut services = Services::new(context.clone());

		// Set sidecar manager in context so it can be accessed by jobs
		context
			.set_sidecar_manager(services.sidecar_manager.clone())
			.await;

		// Set filesystem watcher in context so it can be accessed by jobs (for ephemeral watch registration)
		context.set_fs_watcher(services.fs_watcher.clone()).await;

		// Scan for .sdlibrary directories before attempting to load
		info!("Scanning for library directories...");
		let library_dir_count = libraries.count_library_directories().await;
		info!("Found {} .sdlibrary directories", library_dir_count);

		// Auto-load all libraries with context for job manager initialization
		info!("Loading existing libraries...");
		let mut loaded_libraries: Vec<Arc<crate::library::Library>> =
			match libraries.load_all(context.clone()).await {
				Ok(count) => {
					info!("Loaded {} libraries", count);
					libraries.list().await
				}
				Err(e) => {
					error!("Failed to load libraries: {}", e);
					vec![]
				}
			};

		// Only create default library if NO .sdlibrary directories exist
		if library_dir_count == 0 {
			info!("No library directories found, creating default library 'My Library'");
			match libraries
				.create_library("My Library", None, context.clone())
				.await
			{
				Ok(default_library) => {
					info!("Created default library: {}", default_library.id());
					loaded_libraries.push(default_library);
				}
				Err(e) => {
					error!("Failed to create default library: {}", e);
				}
			}
		} else if loaded_libraries.is_empty() {
			error!(
				"Found {} library directories but none loaded successfully. \
				 Waiting for libraries to become available. \
				 Check logs and frontend notifications for specific load errors.",
				library_dir_count
			);
		}

		// Set context in library manager and start filesystem watching
		libraries.set_context(context.clone()).await;
		if let Err(e) = libraries.start_watching().await {
			warn!("Failed to start library filesystem watcher: {}", e);
		} else {
			info!("Library filesystem watcher started");
		}

		// Load locations from all libraries into the filesystem watcher
		for library in &loaded_libraries {
			info!("Loading locations for library {}", library.id());
			match services.fs_watcher.load_library_locations(library).await {
				Ok(count) => {
					info!("Loaded {} locations from library {}", count, library.id());
				}
				Err(e) => {
					error!(
						"Failed to load locations for library {}: {}",
						library.id(),
						e
					);
				}
			}
		}

		// Initialize sidecar manager for each loaded library
		for library in &loaded_libraries {
			info!("Initializing sidecar manager for library {}", library.id());
			if let Err(e) = services.sidecar_manager.init_library(library).await {
				error!(
					"Failed to initialize sidecar manager for library {}: {}",
					library.id(),
					e
				);
			} else {
				// // Run bootstrap scan in background to avoid blocking startup
				// let sidecar_manager = services.sidecar_manager.clone();
				// let library = Arc::clone(library);
				// tokio::spawn(async move {
				// 	if let Err(e) = sidecar_manager.bootstrap_scan(&library).await {
				// 		error!(
				// 			"Failed to run sidecar bootstrap scan for library {}: {}",
				// 			library.id(),
				// 			e
				// 		);
				// 	}
				// });
			}
		}

		// Set library manager reference in volume manager so it can query tracked volumes
		volumes
			.set_library_manager(Arc::downgrade(&libraries))
			.await;

		// Local-only mode: cloud volumes and P2P networking removed

		let service_config = config.read().await.services.clone();

		info!("Starting background services...");
		match services.start_all_with_config(&service_config).await {
			Ok(()) => info!("Background services started"),
			Err(e) => error!("Failed to start services: {}", e),
		}

		//Initialize ActionManager and set it in context
		let action_manager = Arc::new(crate::infra::action::manager::ActionManager::new(
			context.clone(),
		));
		context.set_action_manager(action_manager).await;

		// Set up log event emitter (no-op, actual setup happens in daemon bootstrap)
		// The LogEventLayer is added as a tracing subscriber layer in bootstrap.rs

		// Initialize API dispatcher
		let api_dispatcher = ApiDispatcher::new(context.clone());

		events.emit(Event::CoreStarted);

		Ok(Self {
			config,
			device,
			libraries,
			volumes,
			events,
			logs,
			services,
			context,
			api_dispatcher,
		})
	}

	/// Get the application configuration
	pub fn config(&self) -> Arc<RwLock<AppConfig>> {
		self.config.clone()
	}

	/// Get the unified API dispatcher
	///
	/// This is the main entry point for enhanced operations with session context,
	/// permissions, and audit trails. Prefer this over direct registry access.
	pub fn api(&self) -> &ApiDispatcher {
		&self.api_dispatcher
	}

	/// Shutdown the core gracefully
	pub async fn shutdown(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
		info!("Shutting down Spacedrive Core...");

		// Networking service is stopped by services.stop_all()

		// Stop all services
		self.services.stop_all().await?;

		// Stop volume monitoring
		self.volumes.stop_monitoring().await;

		// Close all libraries
		self.libraries.close_all().await?;

		// Close KeyManager database to release file locks
		if let Err(e) = self.context.key_manager.close().await {
			warn!("Failed to close KeyManager database: {}", e);
		}

		// Save configuration
		self.config.write().await.save()?;

		// Emit shutdown event
		self.events.emit(Event::CoreShutdown);

		info!("Spacedrive Core shutdown complete");
		Ok(())
	}
}

/// Set up log event emitter to forward tracing events to the event bus
fn setup_log_event_emitter(event_bus: Arc<crate::infra::event::EventBus>) {
	use crate::infra::event::log_emitter::LogEventLayer;
	use std::sync::Once;
	use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

	static SETUP: Once = Once::new();

	SETUP.call_once(|| {
		// Create the log event layer (now global bus is set elsewhere)
		let log_layer = LogEventLayer::new();

		// Try to add it to the existing global subscriber
		// Since we can't modify an existing subscriber, we'll set up a new one
		// This will only work if no subscriber has been set yet
		let _ = tracing_subscriber::registry().with(log_layer).try_init();
	});
}
