## Experimental Results

The following figures summarize the detection performance of the ResNet-1D classifier
trained on Dataset 1 (CHINT AFDD, 6.4 kHz AC current, 230 V / 50 Hz). All results are
reported on **held-out Model D trial recordings** — a complete, independent batch of
recordings across all nine residential load types that was never used during training,
hyperparameter selection, or architectural decisions. The evaluation uses the best
model checkpoint selected by validation AUC, restored by early stopping, ensuring
reported metrics reflect a principled optimum rather than an arbitrary training epoch.

Window classification results are reported at the **512-sample window level** (≈ 80 ms,
approximately four AC cycles at 6.4 kHz). Per-load breakdowns are provided alongside
aggregate metrics to surface load-specific detection difficulty, which aggregate accuracy
alone conceals.

Per-load breakdown available in [per_load_breakdown](per_load_breakdown.csv)

Figure: Per-Load Accuracy
<img width="1590" height="961" alt="Per-Load Accuracy" src="https://github.com/user-attachments/assets/797f61f1-b930-4a0d-9fe1-ae3da887a721" />
*Per-load classification accuracy of the ResNet-1D detector on held-out Model D trial recordings. Each bar represents the fraction of correctly classified 512-sample windows for one residential load type. Red bars fall below the dataset mean (dashed line); blue bars meet or exceed it. Loads with inherently noisy normal-operation current (brushed-motor loads: Air Compressor, Power Tools; discharge loads: Fluorescent Lamp) consistently show lower accuracy than deterministic loads (Electronic Dimmers, Switching Power Supply), consistent with known real-world AFCI nuisance-trip sources documented in IEC 62606.*



Figure: Per-Load Arc Recall
<img width="1591" height="961" alt="Per-Load Arc Recall" src="https://github.com/user-attachments/assets/ea609fbb-5944-4e7b-a783-dd8866b6349f" />
*Per-load arc-class recall (true positive rate) on held-out Model D trial recordings. Recall measures the fraction of genuine arc-fault windows correctly flagged by the detector — the safety-critical metric, since a missed arc (false negative) represents a real fire-risk failure. Power Tools (0.973) and Air Compressor (0.940) show the lowest recall among classified loads, attributable to brushed-motor commutation noise whose stochastic character resembles broadband arc noise in the time domain. All loads exceed 0.90 recall, with Electronic Dimmers, Switching Power Supply, and Vacuum Cleaner achieving perfect detection.*



Figure: Per-Load Multi-Metric Heatmap
<img width="1253" height="961" alt="Per-Load Multi-Metric Heatmap" src="https://github.com/user-attachments/assets/99313341-c0f1-432f-873e-7238dfc909f3" />
*Per-load detection performance heatmap across four classification metrics for the ResNet-1D model evaluated on Model D. Rows are load types sorted by ascending overall accuracy; columns are Accuracy, Arc Precision, Arc Recall, and Arc F1-score. Color intensity encodes performance from red (lower) to green (higher) within the displayed range (0.85–1.00). The heatmap reveals that precision and recall trade differently by load category: brushed-motor loads (Air Compressor, Power Tools) show a precision–recall asymmetry consistent with the presence of load-generated noise that partially overlaps with arc signatures in the time domain.*



Figure: Confusion Matrix
<img width="1051" height="871" alt="Confusion Matrix" src="https://github.com/user-attachments/assets/de2cf6c5-d447-4822-ac14-13c72ee48dc3" />
*Confusion matrix of the ResNet-1D detector (best checkpoint by validation AUC) evaluated on held-out Model D trial recordings. Rows represent true physical states; columns represent model predictions. TN: true negatives (normal windows correctly identified); TP: true positives (arc windows correctly flagged); FP: false positives (nuisance trips — normal windows incorrectly flagged as arc); FN: false negatives (missed arcs — the safety-critical failure mode). The model achieves low counts in both off-diagonal cells, with false negatives outnumbering false positives, reflecting the class-weighted training objective that prioritises arc recall over precision.*



Figure: ROC Curve
<img width="1051" height="871" alt="ROC Curve" src="https://github.com/user-attachments/assets/ae62f0e2-bc4d-4108-8a3e-f732a1405b5d" />
*Receiver Operating Characteristic (ROC) curve of the ResNet-1D detector on held-out Model D trial recordings. The curve sweeps the full range of classification thresholds, plotting the true positive rate (arc detection rate) against the false positive rate (nuisance trip rate) at each threshold. The area under the curve (AUC = 0.9993) indicates near-perfect class separability across all operating points, independent of the fixed 0.5 decision threshold used for the confusion matrix. The shaded region between the curve and the diagonal (random-chance baseline) represents the discriminative capacity of the model.*



