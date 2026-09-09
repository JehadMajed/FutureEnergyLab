# Contributing

Thanks for your interest in the Future Energy Lab repository.

## Ground rules

- **One project per folder.** New work gets its own top-level folder with a `README.md`
  that explains what it is, how to run it, and who owns it.
- **No secrets in git.** Never commit API tokens, passwords, `.env` / `.dev.vars` files,
  Wi-Fi credentials, or private datasets. Use the `*.example` templates.
- **Keep data light.** Commit schemas, small samples, and synthetic examples. Large raw
  datasets belong in external storage and should be referenced by path/URL.
- **Document assumptions.** For sizing, modelling, and simulation work, every number should
  trace back to a stated source or assumption file.

## Workflow

1. Create a branch: `git checkout -b feature/<short-name>`
2. Make your changes and update the relevant `README.md`.
3. Commit with a clear message.
4. Open a pull request describing the change and how it was tested.

## Adding a publication

Edit [`docs/PUBLICATIONS.md`](docs/PUBLICATIONS.md) and add an entry with the title, authors,
venue, year, and status (published / accepted / submitted / in preparation).

## Adding a team member

Edit [`docs/TEAM.md`](docs/TEAM.md).
