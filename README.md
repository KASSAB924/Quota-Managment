# Dynamic Quota Manager

A lightweight, dependency-free JS utility I built for managing dynamic quotas across multiple containers without mutating the source of truth on every UI interaction.

## How to run
Just serve the directory. No build steps required.
```bash
npx serve .
```
*(Or simply open `index.html` using the **Live Server** extension in VS Code).*

## Architecture Notes

If you look at `QuotaManager.js`, you'll notice I don't immediately update the system state when a user clicks `+` or `-`. 

Instead of triggering a global state recalculation (or a potential API call) on every single click, I decided to use a Draft/Delta pattern:

1. State Separation: Each container holds `snapshotItems` (the actual confirmed data) and `localDelta` (uncommitted UI changes).
2. Virtual Computation: I calculate the current effective usage dynamically: `Effective Usage = Snapshot + Delta`.
3. The Bottleneck Math: Before any increment is allowed, my code enforces a strict double-check constraint:
   ```javascript
   Math.min(remainingContainerCapacity, remainingGlobalQuota)
   ```
4. Lazy Commits: I only merge `localDelta` into `snapshotItems` when the user actually hits "Submit Changes".

Why did I do this?
It completely isolates UI interactions from the core state. This prevents race conditions, allows the user to experiment with allocations safely, and makes it incredibly easy for me to hook this up to a real backend later (I'd just send the final payload on submit instead of firing 50 requests per minute).
