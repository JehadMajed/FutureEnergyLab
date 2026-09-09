#!/usr/bin/env python3
"""
Plot an active-power profile from a CSV produced by the extractor
(or from examples/synthetic_sample.csv).

Usage:
    python plot_power_profile.py path/to/appliance.csv
    python plot_power_profile.py data/output/master.csv --column washing_machine --save out.png
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--column", help="column to plot (default: first non-timestamp column)")
    ap.add_argument("--save", type=Path, help="save to file instead of showing")
    args = ap.parse_args()

    df = pd.read_csv(args.csv, parse_dates=["timestamp"], index_col="timestamp")
    col = args.column or df.columns[0]
    if col not in df.columns:
        raise SystemExit(f"column '{col}' not in {list(df.columns)}")

    ax = df[col].plot(figsize=(11, 4), lw=0.9)
    ax.set_title(f"Active power profile — {col}")
    ax.set_xlabel("Time")
    ax.set_ylabel("Active power (W)")
    ax.grid(alpha=0.3)
    plt.tight_layout()

    if args.save:
        plt.savefig(args.save, dpi=130)
        print(f"saved {args.save}")
    else:
        plt.show()


if __name__ == "__main__":
    main()
