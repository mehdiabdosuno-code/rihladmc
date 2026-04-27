"""ERP integration module — outbound RIHLA Invoice → client SAP S/4HANA / Business One.

This module enables RIHLA to push generated invoices directly into a corporate
client's SAP ERP, eliminating double-entry and reducing DSO. Supports two
backends:

  - SAP S/4HANA Cloud (Public Edition) — OData v4, OAuth2 client credentials.
  - SAP Business One (cloud or on-prem) — Service Layer REST, session auth.

A `dry_run` mode lets the entire pipeline be exercised end-to-end without a
real tenant — the request payload that *would* have been sent is recorded in
`ErpPushLog.request_payload` and the call is short-circuited with a fake 200.
"""
