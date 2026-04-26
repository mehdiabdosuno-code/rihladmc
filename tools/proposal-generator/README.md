# S'TOURS Proposal Generator

Generate branded Word documents (.docx) from structured JSON project data.

## Usage

```bash
cd tools/proposal-generator
npm install
node generate.js
```

## Output

- 3-section document:
  - **Section 1**: Official S'TOURS cover page (full-bleed, locked)
  - **Section 2**: Editable title page (travel designer modifies dates/title/route)
  - **Section 3**: Full content with branded header/footer on every page

## Brand assets required

Place these in the same directory:
- `stours_dmc_logo.png` — Full DMC logo (from `docs/`)
- `stours_footer.png` — Footer 3 columns
- `cover_full.png` — Cover template
- `stours_bus.jpg` — Fleet photo

## Input format

See `sample_project.json` for the expected JSON structure.
