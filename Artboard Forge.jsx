#target illustrator
#targetengine "artboard_forge"

(function () {

    if (app.documents.length === 0) {
        alert("Please open an Illustrator document first.");
        return;
    }

    var templateDoc = app.activeDocument;
    var templateDocName = templateDoc.name;

    var delimiter = "auto";
    var gap = 20;
    var artboardLimit = 1000;
    var canvasLimit = 16000;

    var csvData = null;
    var columns = [];
    var csvFileRef = null;
    var logLines = [];

    var win = new Window("dialog", "Artboard Forge");
    win.orientation = "column";
    win.alignChildren = "fill";

    var fileGroup = win.add("group");
    fileGroup.orientation = "row";

    var filePath = fileGroup.add("edittext", undefined, "No CSV file selected");
    filePath.characters = 60;
    filePath.enabled = false;

    var browseBtn = fileGroup.add("button", undefined, "Choose CSV");

    var delimiterGroup = win.add("group");
    delimiterGroup.orientation = "row";
    delimiterGroup.add("statictext", undefined, "CSV delimiter:");

    var delimiterChoice = delimiterGroup.add("dropdownlist", undefined, [
        "Auto detect",
        "Semicolon (;)",
        "Comma (,)",
        "Tab"
    ]);
    delimiterChoice.selection = 0;

    var groupByGroup = win.add("group");
    groupByGroup.orientation = "row";
    groupByGroup.add("statictext", undefined, "Group artboards by:");

    var groupByChoice = groupByGroup.add("dropdownlist", undefined, ["No grouping"]);
    groupByChoice.selection = 0;
    groupByChoice.enabled = false;
    groupByChoice.preferredSize = [260, 24];

    var nameByGroup = win.add("group");
    nameByGroup.orientation = "row";
    nameByGroup.add("statictext", undefined, "Name artboards by:");

    var nameByChoice = nameByGroup.add("dropdownlist", undefined, ["Auto"]);
    nameByChoice.selection = 0;
    nameByChoice.enabled = false;
    nameByChoice.preferredSize = [260, 24];

    var infoBox = win.add("edittext", undefined, "", {
        multiline: true,
        readonly: true,
        scrolling: true
    });
    infoBox.preferredSize = [680, 300];

    var progressText = win.add("statictext", undefined, "Ready");
    var progressBar = win.add("progressbar", undefined, 0, 100);
    progressBar.preferredSize = [680, 16];

    var btnGroup = win.add("group");
    btnGroup.alignment = "right";

    var refreshBtn = btnGroup.add("button", undefined, "Refresh Template Scan");
    var clearBtn = btnGroup.add("button", undefined, "Clear Generated Artboards");
    var generateBtn = btnGroup.add("button", undefined, "Generate Labels");
    var saveLogBtn = btnGroup.add("button", undefined, "Save Log");
    var closeBtn = btnGroup.add("button", undefined, "Close");

    generateBtn.enabled = false;

    browseBtn.onClick = function () {
        var csvFile = File.openDialog("Select CSV file", "*.csv");

        if (!csvFile) return;

        csvFileRef = csvFile;
        filePath.text = csvFile.fsName;
        clearLog();

        try {
            log("Loading CSV: " + csvFile.fsName);

            csvFile.open("r");
            var csvText = csvFile.read();
            csvFile.close();

            csvText = stripBOM(csvText);
            delimiter = getSelectedDelimiter(csvText);
            log("CSV delimiter: " + printableDelimiter(delimiter));

            csvData = parseCSV(csvText, delimiter);

            if (!csvData || csvData.length < 2) {
                log("ERROR: CSV is empty or contains no data rows.");
                generateBtn.enabled = false;
                updateReportSafe();
                return;
            }

            columns = getColumns(csvData[0]);

            if (columns.length === 0) {
                log("ERROR: No valid CSV columns found.");
                generateBtn.enabled = false;
                updateReportSafe();
                return;
            }

            populateGroupByChoice(columns);
            populateNameByChoice(columns);

            log("CSV loaded successfully.");
            log("Expected labels: " + (csvData.length - 1));

            generateBtn.enabled = true;
            updateReportSafe();

        } catch (e) {
            log("ERROR while reading CSV: " + e);
            generateBtn.enabled = false;
            updateReportSafe();
        }
    };

    refreshBtn.onClick = function () {
        updateReportSafe();
        log("Template scan refreshed.");
        updateReportSafe();
    };

    groupByChoice.onChange = function () {
        updateReportSafe();
    };

    nameByChoice.onChange = function () {
        updateReportSafe();
    };

    generateBtn.onClick = function () {
        if (!csvData || csvData.length < 2 || columns.length === 0) {
            alert("Please load a valid CSV first.");
            return;
        }

        generateLabels(csvData, columns);
    };

    clearBtn.onClick = function () {
        clearGeneratedArtboards();
    };

    saveLogBtn.onClick = function () {
        saveLogToDesktop();
    };

    closeBtn.onClick = function () {
        win.close();
    };

    updateReportSafe();
    win.show();

    function getDoc() {
        if (isUsableDocument(templateDoc)) {
            return templateDoc;
        }

        try {
            for (var i = 0; i < app.documents.length; i++) {
                if (app.documents[i].name === templateDocName && isUsableDocument(app.documents[i])) {
                    templateDoc = app.documents[i];
                    return templateDoc;
                }
            }
        } catch (e0) {}

        try {
            if (app.documents.length > 0 && isUsableDocument(app.activeDocument)) {
                templateDoc = app.activeDocument;
                templateDocName = templateDoc.name;
                return templateDoc;
            }
        } catch (e) {}

        try {
            if (app.documents.length > 0 && isUsableDocument(app.documents[0])) {
                templateDoc = app.documents[0];
                templateDocName = templateDoc.name;
                return templateDoc;
            }
        } catch (e2) {}

        throw new Error("No Illustrator document is available. Open the label template document and run the script again.");
    }

    function isUsableDocument(doc) {
        try {
            return doc && doc.artboards && doc.artboards.length > 0;
        } catch (e) {
            return false;
        }
    }

    function updateReportSafe() {
        try {
            updateReport();
        } catch (e) {
            infoBox.text =
                "CSV is loaded, but the Illustrator template document is not available.\n\n" +
                "Close this window, click the template document, and run Artboard Forge again.\n\n" +
                "Log:\n" + logLines.join("\n") +
                "\n[" + getTime() + "] ERROR: " + e;
        }

        try {
            win.update();
            app.redraw();
        } catch (e2) {}
    }

    function updateReport() {
        var doc = getDoc();
        var report = "";

        if (!csvData || columns.length === 0) {
            report += "Load CSV file first.\n";
            report += "\nLog:\n" + logLines.join("\n");
            infoBox.text = report;
            return;
        }

        var placeholders = findPlaceholdersOnActiveArtboard(doc);
        var templateScan = scanTemplateItems(doc, doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect);
        var groupColumn = getSelectedGroupColumn();
        var nameColumn = getSelectedNameColumn();
        var groupSummary = getGroupSummary(csvData, groupColumn);

        report += "CSV status: OK\n";
        report += "Delimiter: " + printableDelimiter(delimiter) + "\n";
        report += "Expected labels: " + (csvData.length - 1) + "\n\n";

        report += "Grouping: ";
        if (groupColumn) {
            report += groupColumn.name + " (" + groupSummary.groups.length + " groups)\n";
            report += "Group order:\n";

            for (var g = 0; g < groupSummary.groups.length; g++) {
                report += "- " + groupSummary.groups[g].label + ": " + groupSummary.groups[g].count + "\n";
            }

            report += "\n";
        } else {
            report += "none\n\n";
        }

        report += "Artboard names: ";
        if (nameColumn) {
            report += nameColumn.name + "\n\n";
        } else {
            report += "auto\n\n";
        }

        report += "Template items on active artboard:\n";
        report += "- usable: " + templateScan.items.length + "\n";
        report += "- skipped locked/hidden: " + templateScan.skipped + "\n\n";

        report += "Available CSV columns and placeholders:\n";
        for (var i = 0; i < columns.length; i++) {
            report += "- " + columns[i].name + " => {{" + columns[i].name + "}}\n";
        }

        report += "\nPlaceholders currently found on active artboard:\n";

        if (placeholders.length === 0) {
            report += "- none found\n";
        } else {
            for (var p = 0; p < placeholders.length; p++) {
                var columnName = placeholderToColumn(placeholders[p]);

                report += "- " + placeholders[p];

                if (hasColumn(columns, columnName)) {
                    report += " OK";
                } else {
                    report += " NO MATCHING CSV COLUMN";
                }

                report += "\n";
            }
        }

        report += "\nIf you need to edit the Illustrator template, close this window, edit the file, then run Artboard Forge again.\n";
        report += "Click 'Refresh Template Scan' after loading CSV to rescan the current template document.\n";

        report += "\nLog:\n" + logLines.join("\n");

        infoBox.text = report;
    }

    function generateLabels(data, columns) {
        var doc = getDoc();
        var groupColumn = getSelectedGroupColumn();
        var nameColumn = getSelectedNameColumn();
        var preparedRows = prepareRows(data, columns, groupColumn);
        var total = preparedRows.length;

        if (doc.artboards.length + total > artboardLimit) {
            alert(
                "Too many labels for one Illustrator document.\n\n" +
                "Current artboards: " + doc.artboards.length + "\n" +
                "Labels to generate: " + total + "\n" +
                "Limit used by this script: " + artboardLimit
            );
            log("ERROR: Artboard limit would be exceeded.");
            updateReportSafe();
            return;
        }

        progressBar.minvalue = 0;
        progressBar.maxvalue = total;
        progressBar.value = 0;

        log("Generation started.");

        var sourceIndex = doc.artboards.getActiveArtboardIndex();
        var rect = doc.artboards[sourceIndex].artboardRect;

        var left = rect[0];
        var top = rect[1];
        var right = rect[2];
        var bottom = rect[3];

        var width = right - left;
        var height = top - bottom;
        var success = 0;
        var failed = 0;
        var templateScan = scanTemplateItems(doc, rect);
        var sourceItems = templateScan.items;
        var usedArtboardNames = getExistingArtboardNames(doc);
        var layout = getGridLayout(rect, width, height, preparedRows);

        if (sourceItems.length === 0) {
            alert("No unlocked and visible template items found on the active artboard.");
            log("ERROR: No unlocked and visible template items found on the active artboard.");
            updateReportSafe();
            return;
        }

        if (!layout.fits) {
            alert(
                "Not enough Illustrator canvas space for all labels.\n\n" +
                "Labels to generate: " + total + "\n" +
                "Maximum that fits from this template position: " + layout.capacity + "\n\n" +
                "Move the template artboard closer to the upper-left area of the Illustrator canvas, reduce the gap, or split the CSV into smaller batches."
            );
            log("ERROR: Not enough Illustrator canvas space. Capacity: " + layout.capacity + ", requested: " + total);
            updateReportSafe();
            return;
        }

        log("Template items found: " + sourceItems.length);
        log("Grid layout: " + layout.columns + " columns x " + layout.rows + " rows.");
        if (groupColumn) {
            log("Grouping by: " + groupColumn.name);
        }
        if (templateScan.skipped > 0) {
            log("Template items skipped because locked/hidden: " + templateScan.skipped);
        }

        for (var r = 0; r < preparedRows.length; r++) {
            try {
                progressText.text = "Generating label " + (r + 1) + " / " + total;
                progressBar.value = r + 1;

                if ((r + 1) % 3 === 0) {
                    win.update();
                    app.redraw();
                }

                var rowInfo = preparedRows[r];
                var row = rowInfo.row;
                var position = getGridPosition(rowInfo.slotIndex, layout, width, height);
                var offsetX = position.offsetX;
                var offsetY = position.offsetY;

                var newRect = [
                    left + offsetX,
                    top + offsetY,
                    right + offsetX,
                    bottom + offsetY
                ];

                doc.artboards.add(newRect);

                var duplicatedItems = duplicateItems(sourceItems, offsetX, offsetY);

                replacePlaceholders(duplicatedItems, row, columns);

                var rawName = getArtboardName(row, columns, rowInfo.csvRowIndex, nameColumn);
                doc.artboards[doc.artboards.length - 1].name = makeUniqueArtboardName(cleanArtboardName(rawName), usedArtboardNames);

                success++;

            } catch (e) {
                failed++;
                log("ERROR on CSV row " + preparedRows[r].csvRowNumber + ": " + e);
            }
        }

        progressText.text = "Done";
        progressBar.value = total;

        log("Generation finished.");
        log("Success: " + success);
        log("Failed: " + failed);

        updateReportSafe();
        saveLogToDesktop();

        alert("Done.\nGenerated: " + success + "\nFailed: " + failed);
    }

    function clearGeneratedArtboards() {
        var doc = getDoc();

        if (doc.artboards.length <= 1) {
            alert("There are no generated artboards to clear.");
            log("Clear skipped: only one artboard exists.");
            updateReportSafe();
            return;
        }

        var templateIndex = doc.artboards.getActiveArtboardIndex();
        var templateName = doc.artboards[templateIndex].name;
        var toRemove = doc.artboards.length - 1;

        var message =
            "This will remove " + toRemove + " artboard(s) and their artwork.\n\n" +
            "The active artboard will be kept as template:\n" +
            templateName + "\n\n" +
            "Make sure the template artboard is active before continuing.";

        if (!confirm(message)) {
            log("Clear generated artboards cancelled.");
            updateReportSafe();
            return;
        }

        progressBar.minvalue = 0;
        progressBar.maxvalue = toRemove;
        progressBar.value = 0;
        progressText.text = "Clearing generated artboards...";

        var removedArtboards = 0;
        var removedItems = 0;
        var failedItems = 0;

        log("Clearing generated artboards. Keeping active artboard: " + templateName);

        for (var i = doc.artboards.length - 1; i >= 0; i--) {
            if (i === templateIndex) continue;

            try {
                var rect = doc.artboards[i].artboardRect;
                var itemResult = removeArtworkTouchingArtboard(doc, rect);

                removedItems += itemResult.removed;
                failedItems += itemResult.failed;

                doc.artboards.remove(i);
                removedArtboards++;
                progressBar.value = removedArtboards;

                if (removedArtboards % 5 === 0) {
                    win.update();
                    app.redraw();
                }
            } catch (e) {
                log("ERROR while clearing artboard " + (i + 1) + ": " + e);
            }
        }

        progressText.text = "Clear done";

        log("Clear finished.");
        log("Removed artboards: " + removedArtboards);
        log("Removed artwork items: " + removedItems);

        if (failedItems > 0) {
            log("Artwork items that could not be removed: " + failedItems);
        }

        updateReportSafe();
        alert(
            "Clear done.\n" +
            "Removed artboards: " + removedArtboards + "\n" +
            "Removed artwork items: " + removedItems +
            (failedItems > 0 ? "\nCould not remove items: " + failedItems : "")
        );
    }

    function removeArtworkTouchingArtboard(doc, rect) {
        var result = {
            removed: 0,
            failed: 0
        };

        for (var i = doc.pageItems.length - 1; i >= 0; i--) {
            var item = doc.pageItems[i];

            if (isNestedPageItem(item)) continue;

            try {
                if (touchesArtboard(item.visibleBounds, rect)) {
                    item.remove();
                    result.removed++;
                }
            } catch (e) {
                result.failed++;
            }
        }

        return result;
    }

    function scanTemplateItems(doc, sourceRect) {
        var result = {
            items: [],
            skipped: 0
        };

        for (var i = doc.pageItems.length - 1; i >= 0; i--) {
            var item = doc.pageItems[i];

            if (isNestedPageItem(item)) continue;

            try {
                if (touchesArtboard(item.visibleBounds, sourceRect)) {
                    if (item.locked || item.hidden || isParentLockedOrHidden(item)) {
                        result.skipped++;
                    } else {
                        result.items.push(item);
                    }
                }
            } catch (e) {}
        }

        return result;
    }

    function duplicateItems(sourceItems, offsetX, offsetY) {
        var copies = [];

        for (var i = 0; i < sourceItems.length; i++) {
            try {
                var copy = sourceItems[i].duplicate();
                copy.translate(offsetX, offsetY);
                copies.push(copy);
            } catch (e) {}
        }

        return copies;
    }

    function replacePlaceholders(items, row, columns) {
        var map = buildColumnMap(row, columns);

        for (var i = 0; i < items.length; i++) {
            replaceRecursive(items[i], map);
        }
    }

    function replaceRecursive(item, valueMap) {
        try {
            if (item.typename === "TextFrame") {
                item.contents = replacePlaceholdersInText(item.contents, valueMap);
            }

            if (item.typename === "GroupItem") {
                for (var i = 0; i < item.pageItems.length; i++) {
                    replaceRecursive(item.pageItems[i], valueMap);
                }
            }
        } catch (e) {}
    }

    function findPlaceholdersOnActiveArtboard(doc) {
        var found = [];
        var sourceIndex = doc.artboards.getActiveArtboardIndex();
        var rect = doc.artboards[sourceIndex].artboardRect;

        for (var i = 0; i < doc.textFrames.length; i++) {
            var tf = doc.textFrames[i];

            try {
                var b = tf.visibleBounds;

                if (touchesArtboard(b, rect)) {
                    var matches = tf.contents.match(/\{\{[^}]+\}\}/g);

                    if (matches) {
                        for (var m = 0; m < matches.length; m++) {
                            addUnique(found, matches[m]);
                        }
                    }
                }
            } catch (e) {}
        }

        return found;
    }

    function getColumns(rawHeaders) {
        var result = [];

        for (var i = 0; i < rawHeaders.length; i++) {
            var name = stripBOM(trim(rawHeaders[i]));

            if (name !== "") {
                result.push({
                    name: name,
                    key: normalizeName(name),
                    index: i
                });
            }
        }

        return result;
    }

    function populateGroupByChoice(columns) {
        groupByChoice.removeAll();
        groupByChoice.add("item", "No grouping");

        for (var i = 0; i < columns.length; i++) {
            groupByChoice.add("item", columns[i].name);
        }

        groupByChoice.selection = 0;
        groupByChoice.enabled = true;
    }

    function populateNameByChoice(columns) {
        nameByChoice.removeAll();
        nameByChoice.add("item", "Auto");

        for (var i = 0; i < columns.length; i++) {
            nameByChoice.add("item", columns[i].name);
        }

        nameByChoice.selection = 0;
        nameByChoice.enabled = true;
    }

    function getSelectedGroupColumn() {
        if (!groupByChoice || !groupByChoice.selection || groupByChoice.selection.index === 0) {
            return null;
        }

        var selectedName = groupByChoice.selection.text;
        var selectedKey = normalizeName(selectedName);

        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === selectedKey) return columns[i];
        }

        return null;
    }

    function getSelectedNameColumn() {
        if (!nameByChoice || !nameByChoice.selection || nameByChoice.selection.index === 0) {
            return null;
        }

        var selectedName = nameByChoice.selection.text;
        var selectedKey = normalizeName(selectedName);

        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === selectedKey) return columns[i];
        }

        return null;
    }

    function prepareRows(data, columns, groupColumn) {
        var rows = [];

        if (!groupColumn) {
            for (var r = 1; r < data.length; r++) {
                rows.push({
                    row: data[r],
                    csvRowIndex: r,
                    csvRowNumber: r + 1,
                    groupKey: "",
                    groupLabel: "",
                    groupItemIndex: r - 1,
                    slotIndex: 0
                });
            }

            return rows;
        }

        var groups = getGroupedRows(data, groupColumn);

        for (var g = 0; g < groups.length; g++) {
            for (var i = 0; i < groups[g].rows.length; i++) {
                groups[g].rows[i].groupItemIndex = i;
                rows.push(groups[g].rows[i]);
            }
        }

        return rows;
    }

    function getGroupedRows(data, groupColumn) {
        var order = [];
        var groups = {};

        for (var r = 1; r < data.length; r++) {
            var row = data[r];
            var rawLabel = trim(row[groupColumn.index] || "");
            var label = rawLabel !== "" ? rawLabel : "Ungrouped";
            var key = normalizeName(label);

            if (!groups[key]) {
                groups[key] = {
                    key: key,
                    label: label,
                    rows: []
                };
                order.push(key);
            }

            groups[key].rows.push({
                row: row,
                csvRowIndex: r,
                csvRowNumber: r + 1,
                groupKey: key,
                groupLabel: label,
                groupItemIndex: 0,
                slotIndex: 0
            });
        }

        var result = [];

        for (var i = 0; i < order.length; i++) {
            result.push(groups[order[i]]);
        }

        return result;
    }

    function getGroupSummary(data, groupColumn) {
        var result = {
            groups: []
        };

        if (!data || data.length < 2 || !groupColumn) {
            return result;
        }

        var grouped = getGroupedRows(data, groupColumn);

        for (var i = 0; i < grouped.length; i++) {
            result.groups.push({
                label: grouped[i].label,
                count: grouped[i].rows.length
            });
        }

        return result;
    }

    function hasColumn(columns, name) {
        var key = normalizeName(name);

        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === key) return true;
        }

        return false;
    }

    function placeholderToColumn(placeholder) {
        return trim(placeholder.replace("{{", "").replace("}}", ""));
    }

    function getArtboardName(row, columns, index, nameColumn) {
        if (nameColumn) {
            var selectedValue = row[nameColumn.index] || "";
            if (trim(selectedValue) !== "") return selectedValue;
        }

        var preferred = [
            "Product",
            "Product Name",
            "Name",
            "Title",
            "Label",
            "Variant",
            "Display Name",
            "SKU",
            "Code",
            "Item Code",
            "Product Code",
            "Catalog Number",
            "Catalogue Number",
            "Reference",
            "Ref",
            "ID",
            "Category",
            "Group",
            "Type",
            "LOT",
            "Lot",
            "Lot Number",
            "Batch",
            "Batch Number"
        ];

        for (var p = 0; p < preferred.length; p++) {
            for (var c = 0; c < columns.length; c++) {
                if (columns[c].key === normalizeName(preferred[p])) {
                    var v = row[columns[c].index] || "";
                    if (trim(v) !== "") return v;
                }
            }
        }

        for (var i = 0; i < columns.length; i++) {
            var value = row[columns[i].index] || "";
            if (trim(value) !== "") return value;
        }

        return "label_" + index;
    }

    function cleanArtboardName(name) {
        var s = String(name).toLowerCase();

        s = s.replace(/Ä…/g, "a");
        s = s.replace(/Ä‡/g, "c");
        s = s.replace(/Ä™/g, "e");
        s = s.replace(/Ĺ‚/g, "l");
        s = s.replace(/Ĺ„/g, "n");
        s = s.replace(/Ăł/g, "o");
        s = s.replace(/Ĺ›/g, "s");
        s = s.replace(/Ĺş/g, "z");
        s = s.replace(/ĹĽ/g, "z");

        s = s.replace(/[^a-z0-9]+/g, "_");
        s = s.replace(/^_+|_+$/g, "");
        s = s.replace(/_+/g, "_");

        if (s === "") s = "label";

        return s;
    }

    function makeUniqueArtboardName(baseName, usedNames) {
        var name = baseName;
        var index = 2;

        while (usedNames[name]) {
            name = baseName + "_" + padNumber(index, 3);
            index++;
        }

        usedNames[name] = true;
        return name;
    }

    function getExistingArtboardNames(doc) {
        var names = {};

        for (var i = 0; i < doc.artboards.length; i++) {
            names[doc.artboards[i].name] = true;
        }

        return names;
    }

    function buildColumnMap(row, columns) {
        var map = {};

        for (var i = 0; i < columns.length; i++) {
            map[columns[i].key] = row[columns[i].index] || "";
        }

        return map;
    }

    function replacePlaceholdersInText(text, valueMap) {
        return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (match, key) {
            var normalized = normalizeName(key);

            if (valueMap[normalized] !== undefined) {
                return valueMap[normalized];
            }

            return match;
        });
    }

    function touchesArtboard(bounds, rect) {
        var tolerance = 2;

        return (
            bounds[2] >= rect[0] - tolerance &&
            bounds[0] <= rect[2] + tolerance &&
            bounds[1] >= rect[3] - tolerance &&
            bounds[3] <= rect[1] + tolerance
        );
    }

    function isNestedPageItem(item) {
        try {
            return item.parent && item.parent.typename !== "Layer";
        } catch (e) {
            return false;
        }
    }

    function isParentLockedOrHidden(item) {
        try {
            var parent = item.parent;

            while (parent && parent.typename !== "Document") {
                if (parent.locked || parent.hidden || parent.visible === false) return true;
                parent = parent.parent;
            }
        } catch (e) {}

        return false;
    }

    function getGridLayout(rect, width, height, preparedRows) {
        var stepX = width + gap;
        var stepY = height + gap;
        var startLeft = rect[0];
        var startTop = rect[1];
        var total = preparedRows.length;
        var minX = -canvasLimit;
        var maxX = canvasLimit;
        var minY = -canvasLimit;
        var maxY = canvasLimit;

        var columnsRight = Math.floor((maxX - rect[2]) / stepX);
        var columnsLeft = Math.floor((rect[0] - minX) / stepX);
        var rowsDown = Math.floor((rect[3] - minY) / stepY);
        var rowsUp = Math.floor((maxY - rect[1]) / stepY);

        var columns = Math.max(1, columnsRight + 1);
        var maxRows = Math.max(1, rowsDown + 1);
        var directionX = 1;
        var directionY = -1;

        if (columnsRight < 1 && columnsLeft > 0) {
            columns = columnsLeft + 1;
            directionX = -1;
        }

        if (rowsDown < 1 && rowsUp > 0) {
            maxRows = rowsUp + 1;
            directionY = 1;
        }

        var dataRows = Math.max(0, maxRows - 1);
        var capacity = columns * dataRows;
        var usedRows = assignGridSlots(preparedRows, columns);

        return {
            columns: columns,
            rows: usedRows + 1,
            capacity: capacity,
            maxRows: maxRows,
            fits: total <= capacity && (usedRows + 1) <= maxRows,
            directionX: directionX,
            directionY: directionY,
            startLeft: startLeft,
            startTop: startTop
        };
    }

    function assignGridSlots(preparedRows, columns) {
        var currentRow = 1;
        var currentCol = 0;
        var previousGroupKey = preparedRows.length > 0 ? preparedRows[0].groupKey : "";
        var maxUsedRow = 1;

        for (var i = 0; i < preparedRows.length; i++) {
            if (i > 0 && preparedRows[i].groupKey !== previousGroupKey) {
                currentRow++;
                currentCol = 0;
                previousGroupKey = preparedRows[i].groupKey;
            }

            if (currentCol >= columns) {
                currentRow++;
                currentCol = 0;
            }

            preparedRows[i].slotIndex = (currentRow * columns) + currentCol;
            if (currentRow > maxUsedRow) maxUsedRow = currentRow;

            currentCol++;
        }

        return maxUsedRow + 1;
    }

    function getGridPosition(index, layout, width, height) {
        var col = index % layout.columns;
        var row = Math.floor(index / layout.columns);

        return {
            offsetX: (width + gap) * col * layout.directionX,
            offsetY: (height + gap) * row * layout.directionY
        };
    }

    function parseCSV(text, delimiter) {
        var rows = [];
        var row = [];
        var cell = "";
        var insideQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var c = text.charAt(i);
            var next = text.charAt(i + 1);

            if (c === '"') {
                if (insideQuotes && next === '"') {
                    cell += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }

            } else if (c === delimiter && !insideQuotes) {
                row.push(cell);
                cell = "";

            } else if ((c === "\n" || c === "\r") && !insideQuotes) {
                if (c === "\r" && next === "\n") i++;

                row.push(cell);

                if (row.join("").replace(/\s/g, "") !== "") {
                    rows.push(row);
                }

                row = [];
                cell = "";

            } else {
                cell += c;
            }
        }

        row.push(cell);

        if (row.join("").replace(/\s/g, "") !== "") {
            rows.push(row);
        }

        return rows;
    }

    function detectDelimiter(text) {
        var firstLine = "";
        var insideQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var c = text.charAt(i);
            var next = text.charAt(i + 1);

            if (c === '"') {
                if (insideQuotes && next === '"') {
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if ((c === "\n" || c === "\r") && !insideQuotes) {
                break;
            }

            firstLine += c;
        }

        var semicolons = countDelimiter(firstLine, ";");
        var commas = countDelimiter(firstLine, ",");
        var tabs = countDelimiter(firstLine, "\t");

        if (tabs > semicolons && tabs > commas) return "\t";
        if (commas > semicolons) return ",";
        return ";";
    }

    function getSelectedDelimiter(text) {
        if (!delimiterChoice || !delimiterChoice.selection || delimiterChoice.selection.index === 0) {
            return detectDelimiter(text);
        }

        if (delimiterChoice.selection.index === 1) return ";";
        if (delimiterChoice.selection.index === 2) return ",";
        if (delimiterChoice.selection.index === 3) return "\t";

        return detectDelimiter(text);
    }

    function countDelimiter(line, delimiter) {
        var count = 0;
        var insideQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);
            var next = line.charAt(i + 1);

            if (c === '"') {
                if (insideQuotes && next === '"') {
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (c === delimiter && !insideQuotes) {
                count++;
            }
        }

        return count;
    }

    function printableDelimiter(value) {
        if (value === "\t") return "tab";
        if (value === ",") return "comma (,)";
        if (value === ";") return "semicolon (;)";
        return String(value);
    }

    function log(message) {
        var line = "[" + getTime() + "] " + message;
        logLines.push(line);

        try {
            progressText.text = message;
            win.update();
        } catch (e) {}
    }

    function getTime() {
        var d = new Date();

        return (
            ("0" + d.getHours()).slice(-2) + ":" +
            ("0" + d.getMinutes()).slice(-2) + ":" +
            ("0" + d.getSeconds()).slice(-2)
        );
    }

    function clearLog() {
        logLines = [];
    }

    function saveLogToDesktop() {
        try {
            var folder = csvFileRef && csvFileRef.parent ? csvFileRef.parent : Folder.desktop;
            var file = new File(folder + "/csv_label_generator_log.txt");

            file.open("w");
            file.write(logLines.join("\n"));
            file.close();

            log("Log saved: " + file.fsName);
        } catch (e) {
            alert("Could not save log:\n" + e);
        }
    }

    function addUnique(arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) return;
        }

        arr.push(value);
    }

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function stripBOM(s) {
        return String(s).replace(/^\uFEFF/, "");
    }

    function normalizeName(s) {
        return stripBOM(trim(s)).toLowerCase().replace(/\s+/g, " ");
    }

    function padNumber(value, size) {
        var s = String(value);

        while (s.length < size) {
            s = "0" + s;
        }

        return s;
    }

})();




