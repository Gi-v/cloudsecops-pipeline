package cloudsecops

# Aggregation entrypoint. The backend calls:
#   POST {OPA_URL}/v1/data/cloudsecops/evaluate   body: {"input": <resource>}
#
# Every *.rego file under cis/, nist/, and iso27001/ contributes to the same
# `violation[v]` and `passed[control_id]` multi-value rules (all files share
# `package cloudsecops`); this file only aggregates them into the single
# response shape the API expects.

evaluate = {
	"violations": [v | violation[v]],
	"passed_controls": [c | passed[c]],
}
