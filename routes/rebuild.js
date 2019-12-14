const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const { indexProducts } = require('../lib/indexing');
const { validateJson } = require('../lib/schema');
const colors = require('colors');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/admin/rebuilds', restrict, async (req, res, next) => {
    const db = req.app.db;
    // get the top results
    const rebuilds = await db.rebuilds.find({}).sort({ created: -1 }).limit(100).toArray();
    res.render('rebuilds', {
        title: 'Cart',
        rebuilds: rebuilds,
        admin: true,
        config: req.app.config,
        session: req.session,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

module.exports = router;
