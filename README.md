# Artboard Forge

Artboard Forge is an Adobe Illustrator script for generating many artboards from one template and a CSV file. It replaces text placeholders, duplicates the template artwork, names artboards from CSV values, and can group generated artboards into organized rows.

It was built for label and packaging workflows, but the logic is generic: any Illustrator template that uses text placeholders can be turned into a CSV-driven batch generator.

## Features

- Generate many Illustrator artboards from one template artboard.
- Replace text placeholders such as `{{Product}}`, `{{Color}}`, or `{{Collection}}`.
- Load CSV files with automatic delimiter detection.
- Supports semicolon, comma, and tab-separated files.
- Handles common Excel CSV quirks, including BOM in the first column.
- Group generated artboards by any CSV column.
- Name generated artboards by any selected CSV column.
- Keep the original template artboard at the top.
- Arrange generated artboards in a grid below the template.
- Detect Illustrator canvas-space limits before generation.
- Clear generated artboards and their artwork while keeping the active template artboard.
- Save a generation log next to the CSV file.

## Requirements

- Adobe Illustrator.
- A document with one prepared template artboard.
- A CSV file with headers in the first row.

The script is written in ExtendScript / JSX.

## Installation

Copy `Artboard Forge.jsx` into Illustrator's Scripts folder.

On Windows, the path usually looks like:

```text
C:\Program Files\Adobe\Adobe Illustrator 2026\Presets\en_US\Scripts\
```

Depending on your Illustrator language, the locale folder may differ, for example `en_US`, `de_DE`, `fr_FR`, etc.

Restart Illustrator after copying the file.

The script should then appear in:

```text
File > Scripts > Artboard Forge
```

## CSV Format

The first row must contain column names.

Example:

```csv
Product;Variant;Color;Collection;SKU;Price
Ceramic Mug;Matte;Black;Homeware;MUG-BLK-001;19.99
Ceramic Mug;Glossy;White;Homeware;MUG-WHT-002;19.99
Canvas Tote;Standard;Natural;Accessories;TOTE-NAT-001;14.99
Notebook;Hardcover;Forest Green;Stationery;NOTE-GRN-004;12.99
```

Supported delimiters:

- Semicolon: `;`
- Comma: `,`
- Tab
- Auto detect

## Placeholders

In Illustrator text frames, use double curly braces with CSV column names:

```text
{{Product}}
{{Variant}}
{{Color}}
{{Collection}}
{{SKU}}
{{Price}}
```

Whitespace and case are normalized, so these are treated as the same column:

```text
{{Product}}
{{ product }}
{{PRODUCT}}
```

The column still needs to exist in the CSV header.

## Basic Workflow

1. Open the Illustrator document that contains the template artboard.
2. Make sure the template artboard is active.
3. Run `Artboard Forge` from Illustrator's Scripts menu.
4. Choose a CSV file.
5. Select the CSV delimiter, or leave it on auto detect.
6. Optionally choose `Group artboards by`.
7. Optionally choose `Name artboards by`.
8. Click `Refresh Template Scan` to verify placeholders.
9. Click `Generate Labels`.

## Grouping

If you choose a column in `Group artboards by`, Artboard Forge keeps records grouped by that column.

For example, if the CSV contains:

```text
Collection = Homeware
Collection = Accessories
Collection = Stationery
```

the layout will be organized like this:

```text
TEMPLATE

Homeware Homeware Homeware
Accessories Accessories
Stationery Stationery Stationery
```

Groups are ordered by their first appearance in the CSV.

Rows inside each group keep their original CSV order.

## Naming Artboards

Use `Name artboards by` to select which CSV column should be used for generated artboard names.

If set to `Auto`, the script tries these columns first:

```text
Product, Product Name, Name, Title, Label, Variant, Display Name,
SKU, Code, Item Code, Product Code, Catalog Number, Catalogue Number,
Reference, Ref, ID, Category, Group, Type, LOT, Lot, Lot Number,
Batch, Batch Number
```

If none of these exist, it uses the first non-empty value in the row.

Generated artboard names are cleaned for Illustrator and made unique automatically.

## Clearing Generated Artboards

The `Clear Generated Artboards` button removes generated artboards and their artwork.

Important:

- The active artboard is kept as the template.
- All other artboards are removed.
- Artwork touching those removed artboards is also removed.
- You will be asked to confirm before anything is deleted.

Before using this feature, click the original template artboard in Illustrator so it is active.

## Template Tips

- Keep all template artwork on the template artboard.
- The script copies artwork that touches or overlaps the active artboard.
- Slight bleed outside the artboard is allowed.
- Locked or hidden artwork is skipped.
- Placeholder text should remain editable text, not outlined paths.
- For rotated text, keep the text frame close to the artboard it belongs to.

## Logs

After generation, Artboard Forge saves:

```text
csv_label_generator_log.txt
```

The log is saved next to the selected CSV file. If that is not possible, it falls back to the desktop.

## Known Limitations

- Illustrator has a finite canvas area. Very large batches may not fit into one document.
- The script checks available space before generation, but complex templates can still hit Illustrator-specific limits.
- Locked and hidden objects are intentionally skipped.
- The clear function is destructive, so use it only after confirming the active artboard is the template.
- This is a JSX script, not a native Illustrator panel extension.

## Development Notes

Artboard Forge uses:

- `Window("dialog")` for a stable Illustrator document context.
- CSV parsing with quoted-field support.
- Placeholder replacement using normalized CSV header names.
- Grid-based artboard positioning to avoid running out of horizontal canvas space.
- Artboard collision checks based on whether artwork touches the source artboard.

## Author

Created by [Jan Wegner](https://github.com/jan-wegner).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
