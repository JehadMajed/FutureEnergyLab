# Publishing this folder to GitHub

This folder is prepared as a single Git repository (`README.md`, `LICENSE`, `.gitignore`,
`CONTRIBUTING.md`, and `docs/`). The nested `.git` folder that used to live inside
`DataSetup/` has been removed so everything is tracked by one repository.

## 1. One-time: create the repository on GitHub

- Go to <https://github.com/new>
- Name: `future-energy-lab` (or under an organization for the lab)
- Visibility: **Public** (or Private if the work is not yet cleared for release)
- Do **not** add a README, license, or .gitignore on GitHub — this folder already has them.

## 2. Initialize and push (run in this folder)

```bash
git init -b main
git add .
git commit -m "Initial commit: Future Energy Lab repository"
git remote add origin https://github.com/<org-or-user>/future-energy-lab.git
git push -u origin main
```

## 3. Before pushing — checklist

- [ ] No secrets committed (`.env`, `.dev.vars`, tokens, Wi-Fi passwords, `secrets.yaml`).
- [ ] Large raw datasets are excluded; only schemas and small/synthetic samples are in.
- [ ] `git status` shows nothing unexpected; `git ls-files | xargs ls -lS | head` to spot large files.
- [ ] Team names and publication statuses in `docs/` are correct.

## 4. Optional polish on GitHub

- Add repository **topics**: `power-systems`, `deep-learning`, `arc-fault`, `microgrid`,
  `smart-metering`, `energy`.
- Set the **About** description to the one-line summary from `README.md`.
- Enable **Issues** and **Discussions** for collaboration.
- If you want a project website, enable **GitHub Pages** from the `main` branch.

## Note on the Arc Fault notebook (73 MB)

`ArcFault/Arc_Fault_Data_Study.ipynb` is large because it stores rendered cell outputs
(plots, dashboards). GitHub warns above 50 MB and rejects above 100 MB. Recommended: commit
a cleared copy and keep the rendered one locally.

```bash
pip install nbconvert
jupyter nbconvert --clear-output --inplace "ArcFault/Arc_Fault_Data_Study.ipynb"
```

Or track it with Git LFS (below).

## Note on large binary files

`Future_Energy_Lab_v2.pptx` and the PDFs in `Instructor Notes/` are committed as-is. If they
grow or change often, consider [Git LFS](https://git-lfs.com/):

```bash
git lfs install
git lfs track "*.pptx" "*.pdf" "*.glb"
git add .gitattributes
```
