"""Railway API integration — add/remove/check custom domains via GraphQL."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

RAILWAY_API = "https://backboard.railway.app/graphql/v2"


def _headers() -> dict:
    token = os.environ.get("RAILWAY_TOKEN", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _service_id() -> str:
    return os.environ.get("RAILWAY_SERVICE_ID", "")


def _env_id() -> str:
    return os.environ.get("RAILWAY_ENVIRONMENT_ID", "")


def is_configured() -> bool:
    return bool(os.environ.get("RAILWAY_TOKEN") and _service_id() and _env_id())


async def add_custom_domain(domain: str) -> dict:
    """Register a custom domain on Railway. Returns {ok, domain_id, error}."""
    if not is_configured():
        return {"ok": False, "error": "RAILWAY_TOKEN / SERVICE_ID / ENVIRONMENT_ID not set"}

    query = """
    mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status { dnsRecords { type name value } }
      }
    }
    """
    variables = {
        "input": {
            "domain": domain,
            "serviceId": _service_id(),
            "environmentId": _env_id(),
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RAILWAY_API,
                json={"query": query, "variables": variables},
                headers=_headers(),
            )
            data = resp.json()
            if "errors" in data:
                msg = data["errors"][0].get("message", "Unknown error")
                logger.warning("Railway add_custom_domain error: %s", msg)
                return {"ok": False, "error": msg}
            result = data.get("data", {}).get("customDomainCreate", {})
            return {"ok": True, "domain_id": result.get("id"), "dns": result.get("status")}
    except Exception as e:
        logger.error("Railway API call failed: %s", e)
        return {"ok": False, "error": str(e)}


async def remove_custom_domain(domain: str) -> dict:
    """Find and delete a custom domain from Railway."""
    if not is_configured():
        return {"ok": False, "error": "Railway not configured"}

    # First find the domain ID
    domain_id = await _find_domain_id(domain)
    if not domain_id:
        return {"ok": True}  # Already gone

    query = """
    mutation CustomDomainDelete($id: String!) {
      customDomainDelete(id: $id)
    }
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RAILWAY_API,
                json={"query": query, "variables": {"id": domain_id}},
                headers=_headers(),
            )
            data = resp.json()
            if "errors" in data:
                msg = data["errors"][0].get("message", "Unknown error")
                return {"ok": False, "error": msg}
            return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def check_domain_status(domain: str) -> dict:
    """
    Check if a custom domain is verified on Railway.
    Returns {ok, status: 'active'|'pending'|'error', cname_target}
    """
    if not is_configured():
        return {"ok": False, "status": "error", "error": "Railway not configured"}

    domain_id = await _find_domain_id(domain)
    if not domain_id:
        return {"ok": False, "status": "not_found"}

    query = """
    query ServiceDomains($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        domains(environmentId: $environmentId) {
          customDomains {
            id domain
            status { dnsRecords { type name value } updatedAt }
          }
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RAILWAY_API,
                json={
                    "query": query,
                    "variables": {"serviceId": _service_id(), "environmentId": _env_id()},
                },
                headers=_headers(),
            )
            data = resp.json()
            domains = (
                data.get("data", {})
                .get("service", {})
                .get("domains", {})
                .get("customDomains", [])
            )
            for d in domains:
                if d.get("domain") == domain or d.get("id") == domain_id:
                    dns_records = (d.get("status") or {}).get("dnsRecords", [])
                    cname = next((r["value"] for r in dns_records if r["type"] == "CNAME"), None)
                    # Railway marks verified domains; absence of errors = active
                    return {
                        "ok": True,
                        "status": "active" if dns_records else "pending",
                        "cname_target": cname,
                        "dns_records": dns_records,
                    }
            return {"ok": False, "status": "not_found"}
    except Exception as e:
        return {"ok": False, "status": "error", "error": str(e)}


async def get_cname_target() -> str | None:
    """Return the CNAME target for this Railway service (the .up.railway.app domain)."""
    if not is_configured():
        return None
    query = """
    query ServiceDomains($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        domains(environmentId: $environmentId) {
          serviceDomains { domain }
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RAILWAY_API,
                json={
                    "query": query,
                    "variables": {"serviceId": _service_id(), "environmentId": _env_id()},
                },
                headers=_headers(),
            )
            data = resp.json()
            domains = (
                data.get("data", {})
                .get("service", {})
                .get("domains", {})
                .get("serviceDomains", [])
            )
            return domains[0]["domain"] if domains else None
    except Exception:
        return None


async def _find_domain_id(domain: str) -> str | None:
    query = """
    query ServiceDomains($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        domains(environmentId: $environmentId) {
          customDomains { id domain }
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RAILWAY_API,
                json={
                    "query": query,
                    "variables": {"serviceId": _service_id(), "environmentId": _env_id()},
                },
                headers=_headers(),
            )
            data = resp.json()
            domains = (
                data.get("data", {})
                .get("service", {})
                .get("domains", {})
                .get("customDomains", [])
            )
            for d in domains:
                if d.get("domain") == domain:
                    return d["id"]
    except Exception:
        pass
    return None
