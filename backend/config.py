"""
Shared configuration: DynamoDB tables, constants.
"""

import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

applicants_table = dynamodb.Table("john-whaley-applicants")
sessions_table = dynamodb.Table("john-whaley-sessions")
settings_table = dynamodb.Table("john-whaley-settings")

VALID_STATUSES = {"pending", "accepted", "rejected", "waitlisted"}

AI_FIELDS = {"ai_review", "ai_score", "ai_reasoning", "attendee_type", "attendee_type_detail", "panel_votes", "accepting_judges"}
