# Email Engine Report

## Templates Present

- Welcome
- Payment succeeded
- Payment failed
- Password reset
- Plan upgraded
- Cancellation save
- Plan cancelled
- Product sold
- Launch success
- Referral invite
- Referral reward
- Abandoned checkout
- Payout requested
- Payout approved
- Payout paid
- Admin broadcast
- Upsell

## Compliance Notes

- Transactional emails should include company address and unsubscribe/preference links before large-scale marketing campaigns.
- Admin broadcast should be used only for opted-in marketing audiences unless classified as transactional.
- SendGrid sender/domain authentication must be verified before launch.

## Live Verification Status

- Code templates: present.
- SendGrid live delivery: blocked pending `SENDGRID_API_KEY` and verified sender/domain DNS.
