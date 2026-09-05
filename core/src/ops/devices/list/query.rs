//! List devices from library database query

use crate::{
	context::CoreContext,
	device::get_current_device_id,
	domain::Device,
	infra::query::{LibraryQuery, QueryError, QueryResult},
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;

/// Input for listing devices from library database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ListLibraryDevicesInput {
	/// Whether to include offline devices (default: true)
	pub include_offline: bool,

	/// Whether to include detailed capabilities and sync leadership info (default: false)
	pub include_details: bool,

	/// Whether to also include paired network devices (default: false)
	#[serde(default)]
	pub show_paired: bool,
}

/// Query to list all devices from the library database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ListLibraryDevicesQuery {
	input: ListLibraryDevicesInput,
}

impl ListLibraryDevicesQuery {
	/// Create a basic device list query
	pub fn basic() -> Self {
		Self {
			input: ListLibraryDevicesInput {
				include_offline: true,
				include_details: false,
				show_paired: false,
			},
		}
	}

	/// Create a detailed device list query
	pub fn detailed() -> Self {
		Self {
			input: ListLibraryDevicesInput {
				include_offline: true,
				include_details: true,
				show_paired: false,
			},
		}
	}

	/// Create a query for online devices only
	pub fn online_only() -> Self {
		Self {
			input: ListLibraryDevicesInput {
				include_offline: false,
				include_details: false,
				show_paired: false,
			},
		}
	}
}

impl LibraryQuery for ListLibraryDevicesQuery {
	type Input = ListLibraryDevicesInput;
	type Output = Vec<Device>;

	fn from_input(input: Self::Input) -> QueryResult<Self> {
		Ok(Self { input })
	}

	async fn execute(
		self,
		context: Arc<CoreContext>,
		session: crate::infra::api::SessionContext,
	) -> QueryResult<Self::Output> {
		// Get the current library from session
		let library_id = session
			.current_library_id
			.ok_or_else(|| QueryError::Internal("No library in session".to_string()))?;

		let library = context
			.libraries()
			.await
			.get_library(library_id)
			.await
			.ok_or_else(|| QueryError::LibraryNotFound(library_id))?;

		// Get database connection
		let db = library.db().conn();

		// Get current device ID for comparison
		let current_device_id = get_current_device_id();

		// Build query to fetch devices from database
		let mut query = crate::infra::db::entities::device::Entity::find();

		// Filter out offline devices if requested
		if !self.input.include_offline {
			query = query.filter(crate::infra::db::entities::device::Column::IsOnline.eq(true));
		}

		// Execute query
		let device_models = query
			.order_by_desc(crate::infra::db::entities::device::Column::LastSeenAt)
			.all(db)
			.await?;

		// Convert to Device domain model
		let mut result = Vec::new();
		for model in device_models {
			match Device::try_from(model) {
				Ok(mut device) => {
					// Set ephemeral fields (defaults - will be updated when merging with network state)
					device.is_current = device.id == current_device_id;
					device.is_paired = false; // Updated below if device is also in network registry
					device.is_connected = false; // Updated below if device is connected via network

					// For remote devices, set is_online based on network connection (will be updated below)
					// For current device, it's always online
					if device.is_current {
						device.is_online = true;
					} else {
						device.is_online = false; // Will be set to true if connected via network
					}

					result.push(device);
				}
				Err(e) => {
					tracing::warn!("Failed to convert device model: {}", e);
				}
			}
		}

		// Local-only mode: mark current device online, others offline
		for d in result.iter_mut() {
			if d.is_current {
				d.is_online = true;
				d.is_connected = false;
			}
		}

		Ok(result)
	}
}

crate::register_library_query!(ListLibraryDevicesQuery, "devices.list");
