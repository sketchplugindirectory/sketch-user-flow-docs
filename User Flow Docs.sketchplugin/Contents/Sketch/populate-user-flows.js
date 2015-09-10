// @import 'libs/sandbox.js';
@import 'libs/constants.js';
@import 'libs/utils.js';

// Globals
var doc;

// onRun handler
function populateUserFlows( context ) {
	doc = context.document;

	var path = getExportsFolder()

	// Get metadata into a JSON object
	var metadataFilePath = path.URLByAppendingPathComponent(metadataFilename)
	var metadataString = [NSString stringWithContentsOfURL:metadataFilePath encoding:NSUTF8StringEncoding error:null]
    var metadata = JSON.parse(metadataString)

    // Get the project name from the metadata
    var projectName = metadata[projectNameJSONKey]
    // Get the document version from the metadata
    var documentVersion = metadata[documentVersionJSONKey]
    // Get the descriptions from the metadata
    var screenData = metadata[sectionsJSONKey]

	// Select first template page
	var templatePage = getPageByName(templatePageName)

	// Get number of screens per page
	var numberOfScreensPerPage = getScreensPerPageFromTemplate(templatePage)

	// Populate cover
	populateCover(projectName, documentVersion)

	// Populate screens
	populateScreens(path, templatePage, numberOfScreensPerPage, projectName, screenData)

	// Remove template
	removeTemplatePages()

	// Let it snow...
	finish()
}


// Ask user to select exports folder
function getExportsFolder() {
    var openPanel = NSOpenPanel.openPanel( )
    openPanel.setCanChooseDirectories(true)
    openPanel.setCanChooseFiles(false)
    openPanel.setCanCreateDirectories(false)

	openPanel.setTitle("Choose your exports folder")
    openPanel.setPrompt("Choose")
    if (openPanel.runModal() == NSOKButton) {
        return openPanel.URL()
    }
}

// Get screens per page from Template > Artboard > Screens group
function getScreensPerPageFromTemplate(templatePage) {
    var artboard = templatePage.artboards().firstObject()

	// Get Screens group
	var screens = getChildLayerByName(artboard, screensLayerGroupName)

    // Get number of children in Screens group
    return screens.layers().length()
}


// Get the 'Screens' group
function getTemplateScreens() {
    return getChildLayerByName(getFirstArtboard(), screensLayerGroupName)
}

// Populate screens
function populateScreens(path, templatePage, numberOfScreensPerPage, projectName, screenData) {
	var fileManager = NSFileManager.defaultManager()
    var folders = fileManager.shallowSubpathsOfDirectoryAtURL( path );

	// Loop through folders
	var folderLoop = folders.objectEnumerator()
    while (folder = folderLoop.nextObject()) {
    	var key = folder.lastPathComponent();
    	var folderData = screenData[ key ];

    	log( folderData.title )

    	// Check if it's a folder and if shouldIgnoreItem should be ignored
    	if( folder.pathExtension() == "" && !shouldIgnoreItem( folderData ) ) {
			// Duplicate Templates page to start
			var pageCount = 0
			var page = duplicateTemplatePage(templatePage)

	    	// Get folder name (for page title)
	        var sectionDisplayName = folderData.original

	    	// Get files for current folder
	    	var files = fileManager.shallowSubpathsOfDirectoryAtURL(folder)
	    	var numberOfFilesInFolder = files.length()
	    	var screensInSectionCount = 0
			var screenCount = 0

			// Sort files like finder
			var sortedFiles = []
		    for ( var i=0; i<numberOfFilesInFolder; i++ ) {
		    	sortedFiles.push( [NSDictionary dictionaryWithObjectsAndKeys: files[i], @"name" ] )
		    }
		    sortedFiles.sort( sortLikeFinder );

		    // Loop through files
			for ( var i=0; i<numberOfFilesInFolder; i++ ) {
				var file = sortedFiles[i].name;
				var key = file.lastPathComponent().stringByDeletingPathExtension();
				var fileData = folderData.screens[ key ];

		        if( shouldIgnoreItem( fileData ) ) {
		        	// If we're not displaying a file, remove it from the numberOfFilesInFolder
		        	// numberOfFilesInFolder--
		        } else {
		            var screenDisplayNumber = fileData.tag
		            var screenDisplayName = fileData.title
		            var screenDescription = fileData.description
				    if (typeof screenDescription != 'string') {
				    	screenDescription = ""
				    }
				    var screenStatus = fileData.status

			    	// Get correct screen group
					var templateScreens = getTemplateScreens()
					var screenGroup = templateScreens.layers().array()[screenCount]

			    	// Get image layer
			    	var imageLayer = getChildLayerByName(screenGroup, screenPlaceholderLayerName)
			    	var maskLayer = getChildLayerByName(screenGroup, screenMaskLayerName)

			    	// // Get image data
		            var data = fileManager.contentsAtPath(file)
		            var img = NSImage.alloc().initWithData(data)
		            var imageCollection = imageLayer.documentData().images()

		            // Update imageLayer with image
		            var imageData = [imageCollection addImage:img convertColourspace:false]
		            imageLayer.image = imageData

		            // Reposition and resize new image
		            // This is mostly used for cropping screens that are too big (e.g. websites)
		            if ( maskLayer && fileData.size.width ) {
						imageLayer.setConstrainProportions( false );

						var rect = CGRectZero;
						rect.size.width = imageLayer.rect().size.width;
						rect.size.height = rect.size.width * fileData.size.height / fileData.size.width;
						rect.origin.x = maskLayer.rect().origin.x;
						rect.origin.y = maskLayer.rect().origin.y;

						imageLayer.setRect( rect );
						imageLayer.setConstrainProportions( true );
		            }

		            // Update screen number
		            setTextOnChildLayerByName( screenGroup, screenNumberLayerName, screenDisplayNumber )

		            // Update heading text
		            setTextOnChildLayerByName( screenGroup, screenHeadingLayerName, screenDisplayName )

		            // Update description
		            setTextOnChildLayerByName( screenGroup, screenDescriptionLayerName, screenDescription )

		            // Update status
		            if ( screenStatus ) {
			            setTextOnChildLayerByName( screenGroup, screenStatusLayerName, screenStatus )
			            var screenStatusLayer = getChildLayerByName( screenGroup, screenStatusLayerName )
			            screenStatusLayer.setIsVisible(true);
			        }

		            // If it's the first screen on a page, update page title
		            if (screenCount === 0) {
			            var header = getChildLayerByName(getFirstArtboard(), headerLayerName)
                        setTextOnChildLayerByName(header, projectNameLayerName, projectName)
                        setTextOnChildLayerByName(header, sectionNameLayerName, sectionDisplayName)

		            	page.setName(sectionDisplayName)
			        }

			        // Update the screenCount
		            screenCount++
		            screensInSectionCount++

		            // If we've run out of screens in this section, remove any unnecessary ones
					var haveRunOutOfScreensForSection = (screensInSectionCount == numberOfFilesInFolder)
		            if (haveRunOutOfScreensForSection) {
		            	// Work out how many slots left
						var slotsLeft = ( numberOfScreensPerPage - screenCount ) % numberOfScreensPerPage

						// Remove empty slots
			            var screens = getChildLayerByName( getFirstArtboard(), screensLayerGroupName )
						for (var j=0; j<slotsLeft; j++) {
							screens.removeLayer(screens.lastLayer())
						}
		            }

		            // If we've run out of screens in this section OR we're on the third screen, duplicate the page and go through loop again
					var haveRunOutOfSlotsForPage = !(screenCount % numberOfScreensPerPage)
		            if (haveRunOutOfSlotsForPage) {
		            	// Update counts
		            	screenCount = 0
		            	pageCount++

		            	// Duplicate page
		            	page = duplicateTemplatePage(templatePage)
		            }

				}

				doc.reloadLayerList();

		    }
		}
    }
}

function shouldIgnoreItem( item ) {
	if( typeof item  == 'undefined' ) {
		return false
	}
	return item.exclude;
}

function duplicateTemplatePage(templatePage) {
    var newPage = templatePage.copy()

    var pages = doc.documentData().pages()
    [pages insertObject:newPage afterObject:doc.currentPage()]
    doc.setCurrentPage(newPage)

    return newPage
}

function populateCover(projectName, documentVersion) {
    // Get the cover page and it's artboard
    var coverPage = getPageByName(coverPageName)
    var coverArtboard = coverPage.artboards().firstObject()

    // Get the cover header
    // TODO: Remove the need to get the header by doing a deep search for layers in the page
    var coverHeader = getChildLayerByName(coverArtboard, coverHeaderLayerGroupName)

    // Set the project name
    setTextOnChildLayerByName(coverArtboard, coverProjectNameLayerName, projectName)
    // Set the version number
    setTextOnChildLayerByName(coverHeader, coverDocumentVersionLayerName, documentVersion)
}

function removeTemplatePages() {
	var templatePages = getPagesByName(templatePageName)
	doc.pages().removeObjectsInArray( templatePages )
}

// TODO: Show save dialog
function finish() {
	doc.showMessage( "All done!" );
}