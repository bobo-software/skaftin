# Email Service Documentation

## Overview

This service sends transactional emails via **AWS Simple Email Service (SES)**
using IAM credentials stored in `.env`. There is no custom SMTP server — all
mail goes through SES.

---

## Provider: AWS SES

| Setting | Value |
|---|---|
| Provider | AWS SES (`boto3` SDK) |
| Region (hardcoded in code) | `eu-west-2` |
| Sender address | `no-reply@accelerit.co.za` *(verified in SES)* |
| Auth type | AWS IAM Access Key / Secret Key |

> **Note:** The `.env` file has `AWS_REGION=us-east-1` but the Python code
> hardcodes `eu-west-2` inside `boto3.client(...)`. When integrating, use the
> region the SES sender identity is actually registered in — confirm this in
> the AWS console.

---

## Environment Variables

```env
MAIL_USERNAME=AKIASI6RDFAA3ZLSSPJK      # AWS IAM Access Key ID
MAIL_PASSWORD=TjqY9Q/OMtxXWc8pH...      # AWS IAM Secret Access Key
```

These are **not** SMTP credentials. They are AWS IAM credentials that
authenticate the SES API call.

---

## How It Works (Python)

```
Email.boto3_aws_client(recipient, subject, html_content)
    └─ boto3.client('ses', region, access_key, secret_key)
           └─ client.send_email(
                  Destination: { ToAddresses: [recipient] },
                  Source: "no-reply@accelerit.co.za",
                  Message: { Subject, Body.Html }
              )
```

The `Email` class (`app/modules/emails/bin/email.py`) has three methods:

| Method | Purpose |
|---|---|
| `boto3_aws_client(email, subject, html)` | Core send — takes raw HTML |
| `send_payment_receipt(user_data, cart, payment_id, status)` | Renders invoice template then calls above |
| `send_vouchers(user_data, items, total)` | Renders voucher template then calls above |

HTML bodies are generated with **Jinja2** templates located in
`app/modules/emails/bin/`.

---

## Integrating from Go

Use the [AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2).

### 1. Install

```bash
go get github.com/aws/aws-sdk-go-v2/config
go get github.com/aws/aws-sdk-go-v2/credentials
go get github.com/aws/aws-sdk-go-v2/service/sesv2
```

### 2. Send an email

```go
package email

import (
    "context"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/sesv2"
    "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

const (
    sender = "no-reply@accelerit.co.za"
    region = "eu-west-2" // must match where the sender identity is verified
)

func SendEmail(accessKey, secretKey, recipient, subject, htmlBody string) error {
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(region),
        config.WithCredentialsProvider(
            credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
        ),
    )
    if err != nil {
        return err
    }

    client := sesv2.NewFromConfig(cfg)

    _, err = client.SendEmail(context.TODO(), &sesv2.SendEmailInput{
        FromEmailAddress: aws.String(sender),
        Destination: &types.Destination{
            ToAddresses: []string{recipient},
        },
        Content: &types.EmailContent{
            Simple: &types.Message{
                Subject: &types.Content{
                    Data:    aws.String(subject),
                    Charset: aws.String("UTF-8"),
                },
                Body: &types.Body{
                    Html: &types.Content{
                        Data:    aws.String(htmlBody),
                        Charset: aws.String("UTF-8"),
                    },
                },
            },
        },
    })

    return err
}
```

### 3. Usage example

```go
err := email.SendEmail(
    os.Getenv("MAIL_USERNAME"),
    os.Getenv("MAIL_PASSWORD"),
    "customer@example.com",
    "Your Payment Receipt",
    "<h1>Thank you for your payment!</h1>",
)
```

---

## IAM Permissions Required

The IAM user (`MAIL_USERNAME`) needs the following SES policy:

```json
{
  "Effect": "Allow",
  "Action": [
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  "Resource": "*"
}
```

---

## Important Constraints (SES)

- **Sender must be verified** — `no-reply@accelerit.co.za` is verified in SES.
  If you want to send from a different address in your Go service, verify it
  first in the AWS SES console.
- **Sandbox mode** — if the AWS account is still in SES sandbox, you can only
  send to verified recipient addresses. Request production access to send to
  any address.
- **Region** — send requests must target the same region where the sender
  identity is verified.
