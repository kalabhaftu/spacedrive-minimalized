//! Device management service (local-only)
//!
//! Provides access to local device information. P2P networking removed.

use crate::context::CoreContext;
use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

/// Service for managing local device information
pub struct DeviceService {
	context: Arc<CoreContext>,
}

impl DeviceService {
	/// Create a new device service
	pub fn new(context: Arc<CoreContext>) -> Self {
		Self { context }
	}

	/// Get context
	pub fn context(&self) -> &Arc<CoreContext> {
		&self.context
	}

	/// Get list of connected device IDs (local-only: empty, no P2P)
	pub async fn get_connected_devices(&self) -> Result<Vec<Uuid>> {
		Ok(Vec::new())
	}

	/// Get detailed information about connected devices (local-only: empty)
	pub async fn get_connected_devices_info(&self) -> Result<Vec<crate::domain::Device>> {
		Ok(Vec::new())
	}
}
