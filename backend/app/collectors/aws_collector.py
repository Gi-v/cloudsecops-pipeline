"""AWS resource collector.

Runs in `simulate` mode by default (no credentials needed — generates a
realistic synthetic inventory). Set COLLECTOR_MODE=live and install the
`live-collectors` extra (`pip install .[live-collectors]`) plus real AWS
credentials in `.env` to point this at a real account — the `collect()`
contract is identical either way, so nothing downstream changes.
"""
import asyncio
from typing import Any

from app.collectors.base import BaseCollector
from app.collectors.simulate import (
    gen_aws_cloudtrail,
    gen_aws_ebs_volumes,
    gen_aws_iam_users,
    gen_aws_s3_buckets,
    gen_aws_security_groups,
)
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AWSCollector(BaseCollector):
    provider = "AWS"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.collector_max_concurrency)

    async def collect(self) -> list[dict[str, Any]]:
        if self.settings.collector_mode == "live":
            return await self._collect_live()
        return await self._collect_simulated()

    async def _collect_simulated(self) -> list[dict[str, Any]]:
        """Mirrors the ADR-004 asyncio.TaskGroup batching pattern even though the
        synthetic generators are non-blocking — this is what the live collector
        below does for real, and keeping the shape identical is the point.
        """
        async def run(fn, *args):
            async with self._semaphore:
                await asyncio.sleep(0.05)  # simulate network latency
                return fn(*args)

        async with asyncio.TaskGroup() as tg:
            s3_task = tg.create_task(run(gen_aws_s3_buckets))
            sg_task = tg.create_task(run(gen_aws_security_groups))
            iam_task = tg.create_task(run(gen_aws_iam_users))
            ebs_task = tg.create_task(run(gen_aws_ebs_volumes))
            ct_task = tg.create_task(run(gen_aws_cloudtrail))

        resources = [
            *s3_task.result(),
            *sg_task.result(),
            *iam_task.result(),
            *ebs_task.result(),
            *ct_task.result(),
        ]
        logger.info("aws_collect_complete", mode="simulate", count=len(resources))
        return resources

    async def _collect_live(self) -> list[dict[str, Any]]:
        """Real AWS collection via boto3. Requires the `live-collectors` extra.

        Structure mirrors ADR-004: independent resource-type fetches run
        concurrently under one TaskGroup rather than sequentially.
        """
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError(
                "COLLECTOR_MODE=live requires the live-collectors extra: "
                "pip install '.[live-collectors]'"
            ) from exc

        session = boto3.Session(
            aws_access_key_id=self.settings.aws_access_key_id or None,
            aws_secret_access_key=self.settings.aws_secret_access_key or None,
            region_name=self.settings.aws_default_region,
        )

        async def list_s3_buckets() -> list[dict]:
            async with self._semaphore:
                s3 = session.client("s3")
                resp = await asyncio.to_thread(s3.list_buckets)
                out = []
                for b in resp.get("Buckets", []):
                    name = b["Name"]
                    try:
                        acl = await asyncio.to_thread(s3.get_bucket_acl, Bucket=name)
                        public = any(
                            g.get("Grantee", {}).get("URI", "").endswith("AllUsers")
                            for g in acl.get("Grants", [])
                        )
                    except Exception:
                        public = False
                    out.append({
                        "resource_urn": f"arn:aws:s3:::{name}",
                        "provider": "AWS",
                        "resource_type": "aws_s3_bucket",
                        "region": self.settings.aws_default_region,
                        "account_id": session.client("sts").get_caller_identity()["Account"],
                        "config": {
                            "bucket_name": name,
                            "acl": "public-read" if public else "private",
                        },
                    })
                return out

        async def list_security_groups() -> list[dict]:
            async with self._semaphore:
                ec2 = session.client("ec2")
                resp = await asyncio.to_thread(ec2.describe_security_groups)
                out = []
                for sg in resp.get("SecurityGroups", []):
                    ingress = [
                        {
                            "from_port": p.get("FromPort"),
                            "to_port": p.get("ToPort"),
                            "cidr": r.get("CidrIp"),
                            "protocol": p.get("IpProtocol"),
                        }
                        for p in sg.get("IpPermissions", [])
                        for r in p.get("IpRanges", [])
                    ]
                    out.append({
                        "resource_urn": f"arn:aws:ec2:security-group:{sg['GroupId']}",
                        "provider": "AWS",
                        "resource_type": "aws_security_group",
                        "region": self.settings.aws_default_region,
                        "account_id": sg.get("OwnerId", "unknown"),
                        "config": {
                            "group_id": sg["GroupId"],
                            "group_name": sg.get("GroupName", ""),
                            "ingress_rules": ingress,
                        },
                    })
                return out

        async with asyncio.TaskGroup() as tg:
            s3_task = tg.create_task(list_s3_buckets())
            sg_task = tg.create_task(list_security_groups())

        resources = [*s3_task.result(), *sg_task.result()]
        logger.info("aws_collect_complete", mode="live", count=len(resources))
        return resources
