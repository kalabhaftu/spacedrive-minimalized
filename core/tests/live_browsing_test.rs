//! # Live Filesystem Browsing Integration Tests
//!
//! Verifies that directory browsing is driven immediately by the real filesystem
//! without requiring locations or folders to be indexed first.

use tempfile::TempDir;

use sd_core::{
	domain::addressing::SdPath,
	domain::file::EntryKind,
	infra::api::SessionContext,
	infra::query::LibraryQuery,
	ops::files::query::{
		directory_listing::{DirectoryListingInput, DirectoryListingQuery, DirectorySortBy},
		file_by_path::FileByPathQuery,
	},
	Core,
};

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_unindexed_directory_browsing_immediate(
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
	let temp_dir = TempDir::new()?;
	let core = Core::new(temp_dir.path().to_path_buf()).await?;

	// Create test directory structure OUTSIDE any location (completely unindexed)
	let unindexed_dir = temp_dir.path().join("unindexed_workspace");
	std::fs::create_dir_all(&unindexed_dir)?;

	std::fs::write(unindexed_dir.join("photo.jpg"), "fake jpg content here")?;
	std::fs::write(unindexed_dir.join("document.pdf"), "sample pdf document")?;
	std::fs::write(unindexed_dir.join("notes.txt"), "some notes text")?;
	std::fs::create_dir_all(unindexed_dir.join("subfolder"))?;
	std::fs::write(unindexed_dir.join(".hidden_config"), "secret config")?;

	// Create library and session
	let library = core
		.libraries
		.create_library("Live Browse Test", None, core.context.clone())
		.await?;

	let device = core.device.to_device()?;
	let session =
		SessionContext::device_session(device.id, device.name.clone()).with_library(library.id());

	// 1. Query without hidden files, folders first
	let query_input = DirectoryListingInput {
		path: SdPath::local(unindexed_dir.clone()),
		folders_first: Some(true),
		limit: None,
		include_hidden: Some(false),
		sort_by: DirectorySortBy::Name,
	};

	let query = DirectoryListingQuery::from_input(query_input)?;
	let response = query.execute(core.context.clone(), session.clone()).await?;

	assert_eq!(
		response.total_count, 4,
		"Should find 4 non-hidden entries immediately"
	);
	assert_eq!(response.files.len(), 4);
	assert!(!response.has_more);

	// First item should be the directory (folders first = true)
	assert_eq!(response.files[0].kind, EntryKind::Directory);
	assert_eq!(response.files[0].name, "subfolder");

	// Verify all expected files are present
	let names: Vec<String> = response
		.files
		.iter()
		.map(|f| match &f.extension {
			Some(ext) => format!("{}.{}", f.name, ext),
			None => f.name.clone(),
		})
		.collect();

	assert!(names.contains(&"subfolder".to_string()));
	assert!(names.contains(&"photo.jpg".to_string()));
	assert!(names.contains(&"document.pdf".to_string()));
	assert!(names.contains(&"notes.txt".to_string()));
	assert!(!names.contains(&".hidden_config".to_string()));

	// Verify file sizes match filesystem
	for file in &response.files {
		if file.name == "photo" && file.extension.as_deref() == Some("jpg") {
			assert_eq!(file.size, "fake jpg content here".len() as u64);
		}
	}

	// 2. Query with hidden files included
	let query_hidden_input = DirectoryListingInput {
		path: SdPath::local(unindexed_dir.clone()),
		folders_first: Some(false),
		limit: None,
		include_hidden: Some(true),
		sort_by: DirectorySortBy::Name,
	};

	let query_hidden = DirectoryListingQuery::from_input(query_hidden_input)?;
	let response_hidden = query_hidden
		.execute(core.context.clone(), session.clone())
		.await?;
	assert_eq!(
		response_hidden.total_count, 5,
		"Should include hidden dotfile"
	);

	// 3. Test immediate live mutation: create a new file and re-query immediately
	std::fs::write(unindexed_dir.join("instant_new_file.rs"), "fn main() {}")?;

	let query_mutation = DirectoryListingQuery::from_input(DirectoryListingInput {
		path: SdPath::local(unindexed_dir.clone()),
		folders_first: Some(false),
		limit: None,
		include_hidden: Some(false),
		sort_by: DirectorySortBy::Name,
	})?;
	let response_mutation = query_mutation
		.execute(core.context.clone(), session.clone())
		.await?;

	assert_eq!(
		response_mutation.total_count, 5,
		"Newly created file must appear immediately"
	);
	let mutation_names: Vec<String> = response_mutation
		.files
		.iter()
		.map(|f| match &f.extension {
			Some(ext) => format!("{}.{}", f.name, ext),
			None => f.name.clone(),
		})
		.collect();
	assert!(mutation_names.contains(&"instant_new_file.rs".to_string()));

	// 4. Test FileByPathQuery on an unindexed file
	let file_path_query = FileByPathQuery::new(unindexed_dir.join("photo.jpg"));
	let file_result = file_path_query
		.execute(core.context.clone(), session.clone())
		.await?;

	assert!(
		file_result.is_some(),
		"Unindexed file should be found by path query"
	);
	let file_obj = file_result.unwrap();
	assert_eq!(file_obj.name, "photo");
	assert_eq!(file_obj.extension.as_deref(), Some("jpg"));
	assert_eq!(file_obj.size, "fake jpg content here".len() as u64);

	Ok(())
}
