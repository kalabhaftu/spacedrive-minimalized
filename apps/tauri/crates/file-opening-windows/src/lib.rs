use file_opening::{FileOpener, OpenResult, OpenWithApp};
use std::path::Path;

#[cfg(not(windows))]
pub struct WindowsFileOpener;

#[cfg(not(windows))]
impl FileOpener for WindowsFileOpener {
	fn get_apps_for_file(&self, _path: &Path) -> Result<Vec<OpenWithApp>, String> {
		Ok(Vec::new())
	}
	fn open_with_default(&self, _path: &Path) -> Result<OpenResult, String> {
		Err("Windows only".into())
	}
	fn open_with_app(&self, _path: &Path, _app_id: &str) -> Result<OpenResult, String> {
		Err("Windows only".into())
	}
}

#[cfg(windows)]
mod imp;

#[cfg(windows)]
pub use imp::WindowsFileOpener;
