# 0002: `/healthz` path and semantics

Status: accepted (F-01)

## Context

The SRD requires `/healthz` but does not say where it is mounted or what it checks.

## Decision

`GET /healthz` is mounted at the root (not under `/api/v1`, so it is stable for container health checks) and reports liveness only. It returns the standard success envelope `{"success":true,"data":{"status":"ok"}}`. It does not check MySQL or Redis because neither exists yet.

## Consequences

Readiness checks that probe dependencies can be added in F-02 or F-23 as a separate endpoint without changing this contract.
