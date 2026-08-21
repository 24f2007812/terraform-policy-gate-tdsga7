const express = require('express');
const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json());

app.post('/terraform/plan', (req, res) => {
    const body = req.body;

    // Rule 1: Type Validation (INVALID_PLAN)
    if (!body ||
        typeof body.environment !== 'string' ||
        typeof body.state !== 'object' || body.state === null ||
        typeof body.state.backend !== 'string' ||
        typeof body.state.locked !== 'boolean' ||
        typeof body.providerVersion !== 'string' ||
        typeof body.destroyApproved !== 'boolean' ||
        typeof body.resource !== 'object' || body.resource === null ||
        typeof body.resource.address !== 'string' ||
        typeof body.resource.type !== 'string' ||
        typeof body.resource.action !== 'string' ||
        typeof body.resource.labels !== 'object' || body.resource.labels === null ||
        (body.resource.secret !== null && typeof body.resource.secret !== 'string') ||
        typeof body.resource.forceDestroy !== 'boolean'
    ) {
        return res.json({ decision: "reject", reason: "INVALID_PLAN" });
    }

    // Rule 2: Environment Match (ENVIRONMENT_MISMATCH)
    if (body.environment !== "prod-4p8zoi") {
        return res.json({ decision: "reject", reason: "ENVIRONMENT_MISMATCH" });
    }

    // Rule 3: State Unsafe (STATE_UNSAFE)
    const validBackends = ["gcs", "s3", "azurerm", "remote"];
    if (!validBackends.includes(body.state.backend) || body.state.locked !== true) {
        return res.json({ decision: "reject", reason: "STATE_UNSAFE" });
    }

    // Rule 4: Unpinned Provider (UNPINNED_PROVIDER)
    // Matches "6.2.1", "= 6.2.1", or "~> 6.0". Rejects >=, *, latest, etc.
    const providerRegex = /^(~>|=)?\s*\d+\.\d+(\.\d+)?$/;
    const isUnpinned = />=|<|\*|latest/.test(body.providerVersion);
    if (isUnpinned || !providerRegex.test(body.providerVersion.trim())) {
        return res.json({ decision: "reject", reason: "UNPINNED_PROVIDER" });
    }

    // Rule 5: Missing Labels (MISSING_LABELS)
    const labels = body.resource.labels;
    if (
        labels.owner !== "student-0rkev" ||
        labels.environment !== "production" ||
        labels.cost_center !== "cc-vgyb"
    ) {
        return res.json({ decision: "reject", reason: "MISSING_LABELS" });
    }

    // Rule 6: Plaintext Secret (PLAINTEXT_SECRET)
    const secret = body.resource.secret;
    if (secret !== null) {
        if (!secret.startsWith("secret://") || secret === "secret://") {
            return res.json({ decision: "reject", reason: "PLAINTEXT_SECRET" });
        }
    }

    // Rule 7: Delete Not Approved (DELETE_NOT_APPROVED)
    const statefulTypes = ["storage_bucket", "sql_database", "persistent_disk"];
    if (
        body.resource.action === "delete" &&
        statefulTypes.includes(body.resource.type) &&
        body.destroyApproved === false
    ) {
        return res.json({ decision: "reject", reason: "DELETE_NOT_APPROVED" });
    }

    // Rule 8: Force Destroy (FORCE_DESTROY)
    if (body.resource.type === "storage_bucket" && body.resource.forceDestroy === true) {
        return res.json({ decision: "reject", reason: "FORCE_DESTROY" });
    }

    // All rules passed
    return res.json({ decision: "approve", reason: "APPROVE" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});