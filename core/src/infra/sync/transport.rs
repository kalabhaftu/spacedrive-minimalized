//! Local-only transport stub (P2P networking removed)

use anyhow::Result;
use uuid::Uuid;

/// Local-only transport: all remote operations are no-ops.
/// Kept for API compatibility with tests that reference NetworkTransport.
#[async_trait::async_trait]
pub trait NetworkTransport: Send + Sync {
	async fn send_sync_message(
		&self,
		_target_device: Uuid,
		_message: serde_json::Value,
	) -> Result<()> {
		Ok(())
	}

	async fn send_sync_request(
		&self,
		_target_device: Uuid,
		_request: serde_json::Value,
	) -> Result<serde_json::Value> {
		Ok(serde_json::Value::Null)
	}

	async fn get_connected_sync_partners(
		&self,
		_library_id: Uuid,
		_db: &sea_orm::DatabaseConnection,
	) -> Result<Vec<Uuid>> {
		Ok(vec![])
	}

	async fn is_device_reachable(&self, _device_uuid: Uuid) -> bool {
		false
	}

	fn transport_name(&self) -> &'static str {
		"LocalTransport"
	}
}
