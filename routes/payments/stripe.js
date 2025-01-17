const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const numeral = require('numeral');
const stripe = require('stripe')(common.getPaymentConfig().secretKey);
const router = express.Router();

// The homepage of the site
router.post('/checkout_action', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const stripeConfig = common.getPaymentConfig();

    // charge via stripe
    stripe.charges.create({
        amount: numeral(req.session.totalCartAmount).format('0.00').replace('.', ''),
        currency: stripeConfig.stripeCurrency,
        source: req.body.stripeToken,
        description: stripeConfig.stripeDescription
    }, (err, charge) => {
        if(err){
            console.info(err.stack);
            req.session.messageType = 'danger';
            req.session.message = 'Your payment has declined. Please try again';
            req.session.paymentApproved = false;
            req.session.paymentDetails = '';
            res.redirect('/pay');
            return;
        }

        // order status
        let paymentStatus = 'Paid';
        if(charge.paid !== true){
            paymentStatus = 'Declined';
        }

        // new order doc
        const orderDoc = {
            orderPaymentId: charge.id,
            orderPaymentGateway: 'Stripe',
            orderPaymentMessage: charge.outcome.seller_message,
            orderTotal: req.session.totalCartAmount,
            orderEmail: req.body.shipEmail,
            orderFirstname: req.body.shipFirstname,
            orderLastname: req.body.shipLastname,
            orderAddr1: req.body.shipAddr1,
            orderAddr2: req.body.shipAddr2,
            orderCountry: req.body.shipCountry,
            orderState: req.body.shipState,
            orderPostcode: req.body.shipPostcode,
            orderPhoneNumber: req.body.shipPhoneNumber,
            orderComment: req.body.orderComment,
            orderStatus: paymentStatus,
            orderDate: new Date(),
            orderProducts: req.session.cart,
            orderType: 'Single'
        };

        // insert order into DB
        db.orders.insertOne(orderDoc, (err, newDoc) => {
            if(err){
                console.info(err.stack);
            }

            // get the new ID
            const newId = newDoc.insertedId;

            // add to lunr index
            indexOrders(req.app)
            .then(() => {
                // if approved, send email etc
                if(charge.paid === true){
                    // set the results
                    req.session.messageType = 'success';
                    req.session.message = 'Your payment was successfully completed';
                    req.session.paymentEmailAddr = newDoc.ops[0].orderEmail;
                    req.session.paymentApproved = true;
                    req.session.paymentDetails = '<p><strong>Order ID: </strong>' + newId + '</p><p><strong>Transaction ID: </strong>' + charge.id + '</p>';

                    // set payment results for email
                    const paymentResults = {
                        message: req.session.message,
                        messageType: req.session.messageType,
                        paymentEmailAddr: req.session.paymentEmailAddr,
                        paymentApproved: true,
                        paymentDetails: req.session.paymentDetails
                    };

                    // clear the cart
                    if(req.session.cart){
                        req.session.cart = null;
                        req.session.orderId = null;
                        req.session.totalCartAmount = 0;
                    }

                    // send the email with the response
                    // TODO: Should fix this to properly handle result
                    common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.renderPaymentEmail(paymentResults));

                    // redirect to outcome
                    res.redirect('/payment/' + newId);
                }else{
                    // redirect to failure
                    req.session.messageType = 'danger';
                    req.session.message = 'Your payment has declined. Please try again';
                    req.session.paymentApproved = false;
                    req.session.paymentDetails = '<p><strong>Order ID: </strong>' + newId + '</p><p><strong>Transaction ID: </strong>' + charge.id + '</p>';
                    res.redirect('/payment/' + newId);
                }
            });
        });
    });
});

// Subscription hook from Stripe
router.all('/subscription_update', async (req, res, next) => {
    const db = req.app.db;
    const stripeSigSecret = common.getPaymentConfig().stripeWebhookSecret;
    const stripeSig = req.headers['stripe-signature'];

    let hook;
    if(stripeSigSecret){
        try{
            hook = await stripe.webhooks.constructEvent(req.rawBody, stripeSig, stripeSigSecret);
            console.info('Stripe Webhook received');
        }catch(err){
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if(!hook.data.object.customer){
            return res.status(400).json({ message: 'Customer not found' });
        }
    }else{
        hook = req.body;
    }

    const order = await db.orders.findOne({
        orderCustomer: hook.data.object.customer,
        orderType: 'Subscription'
    });

    if(!order){
        return res.status(400).json({ message: 'Order not found' });
    }

    let orderStatus = 'Paid';
    if(hook.type === 'invoice.payment_failed'){
        orderStatus = 'Declined';
    }

    // Update order status
    await db.orders.updateOne({
        _id: common.getId(order._id),
        orderType: 'Subscription'
    }, {
        $set: {
            orderStatus: orderStatus
        }
    });

    return res.status(200).json({ message: 'Status successfully updated' });
});

router.post('/checkout_action_subscription', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;

    try{
        const plan = await stripe.plans.retrieve(req.body.stripePlan);
        if(!plan){
            req.session.messageType = 'danger';
            req.session.message = 'The plan connected to this product doesn\'t exist';
            res.redirect('/pay/');
            return;
        }
    }catch(ex){
        req.session.messageType = 'danger';
        req.session.message = 'The plan connected to this product doesn\'t exist';
        res.redirect('/pay/');
        return;
    }

    // Create customer
    const customer = await stripe.customers.create({
        source: req.body.stripeToken,
        plan: req.body.stripePlan,
        email: req.body.shipEmail,
        name: `${req.body.shipFirstname} ${req.body.shipLastname}`,
        phone: req.body.shipPhoneNumber
    });

    if(!customer){
        req.session.messageType = 'danger';
        req.session.message = 'Your subscripton has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = '';
        res.redirect('/pay');
        return;
    }

    // Check for a subscription
    if(customer.subscriptions.data && customer.subscriptions.data.length === 0){
        req.session.messageType = 'danger';
        req.session.message = 'Your subscripton has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = '';
        res.redirect('/pay');
        return;
    }

    const subscription = customer.subscriptions.data[0];

    // Create the new order document
    const orderDoc = {
        orderPaymentId: subscription.id,
        orderPaymentGateway: 'Stripe',
        orderPaymentMessage: subscription.collection_method,
        orderTotal: req.session.totalCartAmount,
        orderEmail: req.body.shipEmail,
        orderFirstname: req.body.shipFirstname,
        orderLastname: req.body.shipLastname,
        orderAddr1: req.body.shipAddr1,
        orderAddr2: req.body.shipAddr2,
        orderCountry: req.body.shipCountry,
        orderState: req.body.shipState,
        orderPostcode: req.body.shipPostcode,
        orderPhoneNumber: req.body.shipPhoneNumber,
        orderComment: req.body.orderComment,
        orderStatus: 'Pending',
        orderDate: new Date(),
        orderProducts: req.session.cart,
        orderType: 'Subscription',
        orderCustomer: customer.id
    };

    // insert order into DB
    const order = await db.orders.insertOne(orderDoc);
    const orderId = order.insertedId;

    indexOrders(req.app)
    .then(() => {
        // set the results
        req.session.messageType = 'success';
        req.session.message = 'Your subscription was successfully created';
        req.session.paymentEmailAddr = req.body.shipEmail;
        req.session.paymentApproved = true;
        req.session.paymentDetails = '<p><strong>Order ID: </strong>' + orderId + '</p><p><strong>Subscription ID: </strong>' + subscription.id + '</p>';

        // set payment results for email
        const paymentResults = {
            message: req.session.message,
            messageType: req.session.messageType,
            paymentEmailAddr: req.session.paymentEmailAddr,
            paymentApproved: true,
            paymentDetails: req.session.paymentDetails
        };

        // clear the cart
        if(req.session.cart){
            req.session.cartSubscription = null;
            req.session.cart = null;
            req.session.orderId = null;
            req.session.totalCartAmount = 0;
        }

        // send the email with the response
        common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.renderPaymentEmail(paymentResults));

        // redirect to outcome
        res.redirect('/payment/' + orderId);
    });
});

module.exports = router;
