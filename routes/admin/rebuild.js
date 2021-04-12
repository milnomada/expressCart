const express = require('express');
const common = require('../../lib/common');
const { restrict } = require('../../lib/auth');
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

// delete order
router.get('/admin/rebuild/delete/:id', restrict, async(req, res) => {
    const db = req.app.db;

    // remove the order
    try{
        await db.rebuilds.deleteOne({ _id: common.getId(req.params.id) });

        if(req.apiAuthenticated){
            res.status(200).json({
                message: 'Order successfully deleted'
            });
            return;
        }

        // redirect home
        req.session.message = 'Rebuild successfully deleted';
        req.session.messageType = 'success';
        res.redirect('/admin/rebuilds');

    } catch(ex){
        console.log('Cannot delete rebuild', ex);
        if(req.apiAuthenticated){
            res.status(200).json({
                message: 'Error deleting rebuild'
            });
            return;
        }

        // redirect home
        req.session.message = 'Error deleting rebuild';
        req.session.messageType = 'danger';
        res.redirect('/admin/rebuilds');
    }
});

module.exports = router;
