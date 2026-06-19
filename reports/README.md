# FactoFit Reports

The original files in this directory belonged to a separate entertainment-news
report project and were not compatible with FactoFit.

The FactoFit application-report implementation now lives in:

- `backend/app/services/application_report.py`
- `backend/app/routers/reports.py`
- `backend/scripts/generate_demo_application_report.py`

Generated PDF files are written to `backend/generated_reports/` and are ignored
by Git.
