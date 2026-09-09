# Examples

## `synthetic_sample.csv`

**Synthetic, generated data — not a real measurement.** It mimics the shape of a multi-mode
washing-machine active-power profile (idle → heating → wash agitation → drain → spin → spin-down)
so the plotting helper runs with no hardware.

```bash
python ../software/plotting/plot_power_profile.py synthetic_sample.csv
```

Columns: `timestamp`, `washing_machine` (active power, W). 1 s interval, ~40 minutes.

Replace with real output from `software/extractor/` once your DAQ nodes are collecting.
