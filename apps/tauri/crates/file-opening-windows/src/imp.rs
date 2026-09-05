use file_opening::{FileOpener, OpenResult, OpenWithApp};
use std::path::Path;
use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::*;
use windows::Win32::UI::WindowsAndMessaging::*;

// Thread-local COM initialization
thread_local! {
	static COM_INITIALIZED: std::cell::RefCell<bool> = std::cell::RefCell::new(false);
}

fn ensure_com_initialized() {
	COM_INITIALIZED.with(|initialized| {
		if !*initialized.borrow() {
			unsafe {
				let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
			}
			*initialized.borrow_mut() = true;
		}
	});
}

pub struct WindowsFileOpener;

impl FileOpener for WindowsFileOpener {
	fn get_apps_for_file(&self, path: &Path) -> std::result::Result<Vec<OpenWithApp>, String> {
		ensure_com_initialized();

		let ext = path
			.extension()
			.and_then(|e| e.to_str())
			.map(|e| format!(".{}", e))
			.unwrap_or_default();

		if ext.is_empty() {
			return Ok(vec![]);
		}

		list_apps_for_extension(&ext)
	}

	fn open_with_default(&self, path: &Path) -> std::result::Result<OpenResult, String> {
		ensure_com_initialized();

		let path_str = path.to_str().ok_or("Invalid UTF-8 in path")?;
		let h_path = HSTRING::from(path_str);

		unsafe {
			let result = ShellExecuteW(None, w!("open"), &h_path, None, None, SW_SHOWNORMAL);

			// ShellExecute returns HINSTANCE > 32 on success
			let code = result.0 as usize;
			if code > 32 {
				Ok(OpenResult::Success)
			} else {
				match code {
					2 => Ok(OpenResult::FileNotFound {
						path: path_str.to_string(),
					}),
					5 => Ok(OpenResult::PermissionDenied {
						path: path_str.to_string(),
					}),
					_ => Ok(OpenResult::PlatformError {
						message: format!("ShellExecute failed with error code: {}", code),
					}),
				}
			}
		}
	}

	fn open_with_app(&self, path: &Path, app_id: &str) -> std::result::Result<OpenResult, String> {
		ensure_com_initialized();

		let ext = path
			.extension()
			.and_then(|e| e.to_str())
			.map(|e| format!(".{}", e))
			.unwrap_or_default();

		let path_str = path.to_str().ok_or("Invalid UTF-8 in path")?;

		unsafe {
			// Find the handler for this app_id
			let handlers = SHAssocEnumHandlers(&HSTRING::from(&ext), ASSOC_FILTER_RECOMMENDED)
				.map_err(|e| e.to_string())?;

			loop {
				let mut handler_array: [Option<IAssocHandler>; 1] = [None];
				let mut fetched = 0u32;

				if handlers
					.Next(&mut handler_array, Some(&mut fetched))
					.is_err() || fetched == 0
				{
					break;
				}

				if let Some(handler) = &handler_array[0] {
					let name = handler
						.GetName()
						.map_err(|e| e.to_string())?
						.to_string()
						.map_err(|e| e.to_string())?;

					if name == app_id {
						// Create ShellItem from path
						let item: IShellItem =
							SHCreateItemFromParsingName(&HSTRING::from(path_str), None)
								.map_err(|e| e.to_string())?;

						// Get IDataObject from ShellItem
						let data_object: windows::Win32::System::Com::IDataObject = item
							.BindToHandler(None, &BHID_DataObject)
							.map_err(|e| e.to_string())?;

						handler.Invoke(&data_object).map_err(|e| e.to_string())?;

						return Ok(OpenResult::Success);
					}
				}
			}

			Ok(OpenResult::AppNotFound {
				app_id: app_id.to_string(),
			})
		}
	}
}

fn list_apps_for_extension(ext: &str) -> std::result::Result<Vec<OpenWithApp>, String> {
	unsafe {
		let handlers = SHAssocEnumHandlers(&HSTRING::from(ext), ASSOC_FILTER_RECOMMENDED)
			.map_err(|e| e.to_string())?;

		let mut apps = Vec::new();

		loop {
			let mut handler_array: [Option<IAssocHandler>; 1] = [None];
			let mut fetched = 0u32;

			if handlers
				.Next(&mut handler_array, Some(&mut fetched))
				.is_err() || fetched == 0
			{
				break;
			}

			if let Some(handler) = &handler_array[0] {
				let name = handler
					.GetName()
					.map_err(|e| e.to_string())?
					.to_string()
					.map_err(|e| e.to_string())?;

				apps.push(OpenWithApp {
					id: name.clone(),
					name,
					icon: None,
				});
			}
		}

		apps.sort_by(|a, b| a.name.cmp(&b.name));
		Ok(apps)
	}
}
