const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const paypal = require('paypal-rest-sdk');
const router = express.Router();

/**
 * 
 * @param  {http session} session         - current session
 * @param  {paypal configuration} conf    - configuration from settings.json
 * @return {array} Items purchased
 */
const productsToItems = (session, conf) => {
  /**
   * { productId: '5dd5be13db8a226217868773',
       title: 'Kala 1 2',
       quantity: 1,
       totalItemPrice: 50,
       options: {},
       productImage: '/uploads/5dd5be13db8a226217868773/DSC_0039.jpg',
       productComment: null,
       productSubscription: null,
       link: 'kala-1-2' }
   */
  var items = session.cart.map(e => { return {
    name: e.title,
    sku: e.title,
    currency: conf.paypalCurrency,
    price: e.productDiscount ? e.totalItemPrice - (e.totalItemPrice / e.productDiscount) : e.totalItemPrice,
    quantity: e.quantity
  } } )
  if(session.shippingCostApplied) {
    items.push({
      name: "Shipping",
      sku: `shipping-${session.customer.country}`,
      currency: conf.paypalCurrency,
      price: getShippingCosts(session.customer.country, session.customer.state || ""),
      quantity: 1
    })
  }
  console.log(items)
  return items
}

const renderDescrption = (arr) => {
  return `Kala® Shopping cart ${arr.length} items`
}

const getShippingCosts = (country, region) => {
  // This will be improved in the future
  switch (country) {
    case "Spain":
      return 10
    case "Portugal":
      return 10
    case "Italy": 
      switch(region) {
        case "Sicily":
          return 15
        case "Sardenya":
          return 15
        default:
          return 10
      }
    case "France":
      return 10
    default:
      return 10
  }
}

/**
 * Translate Status from payment to rebuild
 *  case 0: created
 *  case 1: confirmed
 *  case 2: paid
 *  case 3: started -- building, set manually when start the actual build
 *  case 4: sent
 *  case 5: cancelled
 *  
 * @param  {String} status    Payment status string
 * @return {Int}              Integer rebuild code
 */
const translateToRebuildStatus = (status) => {
  switch(status){
    case 'Paid':
        return 2;
    case 'Approved':
        return 1;
    case 'Approved - Processing':
        return 1;
    case 'Declined':
        return 5;
    case 'Completed':
        return 2;
    case 'Shipped':
        return 4;
    case 'Pending':
        return 0;
    default:
        return 0;
  }
}

router.get('/checkout_cancel', (req, res, next) => {
    const db = req.app.db;
    if(req.session.isRebuild) {
        // update rebuild status
        db.rebuilds.updateOne({_id: common.getId(req.session.rebuildId)}, {$set: {status: translateToRebuildStatus("Pending")}}, {upsert: true})
    }
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paymentId = req.session.paymentId;
    const payerId = req.query.PayerID;

    const details = { payer_id: payerId };
    paypal.payment.execute(paymentId, details, (error, payment) => {
        let paymentApproved = false;
        let paymentMessage = '';
        let paymentDetails = '';
        if(error){
            paymentApproved = false;

            if(error.response.name === 'PAYMENT_ALREADY_DONE'){
                paymentApproved = false;
                paymentMessage = error.response.message;
            }else{
                paymentApproved = false;
                paymentDetails = error.response.error_description;
            }

            // set the error
            req.session.messageType = 'danger';
            req.session.message = error.response.error_description;
            req.session.paymentApproved = paymentApproved;
            req.session.paymentDetails = paymentDetails;

            if(req.session.isRebuild) {
                // update rebuild status
                db.rebuilds.updateOne({_id: common.getId(req.session.rebuildId)}, {$set: {status: translateToRebuildStatus("Failed")}}, {upsert: true})
            }

            res.redirect('/payment/' + req.session.orderId);
            return;
        }

        const paymentOrderId = req.session.orderId;
        const cart = req.session.cart
        let paymentStatus = 'Approved';

        console.log("-->", payment);

        // fully approved
        if(payment.state === 'approved'){
            paymentApproved = true;
            paymentStatus = 'Paid';
            paymentMessage = 'Your payment was successfully completed';
            paymentDetails = '<p><strong>Order ID: </strong>' + paymentOrderId + '</p><p><strong>Transaction ID: </strong>' + payment.id + '</p>';
        }

        // failed
        if(payment.failureReason){
            paymentApproved = false;
            paymentMessage = 'Your payment failed - ' + payment.failureReason;
            paymentStatus = 'Declined';
        }

        // update the order status
        db.orders.updateOne({ _id: common.getId(paymentOrderId) }, { $set: { orderStatus: paymentStatus } }, { multi: false }, (err, numReplaced) => {
            if(err){
                console.info(err.stack);
            }
            if(req.session.isRebuild) {
                // update rebuild status
                db.rebuilds.updateOne({_id: common.getId(req.session.rebuildId)}, {$set: {status: translateToRebuildStatus(paymentStatus)}}, {upsert: true})
            }
            db.orders.findOne({ _id: common.getId(paymentOrderId) }, (err, order) => {
                if(err){
                    console.info(err.stack);
                }

                // add to lunr index
                indexOrders(req.app)
                .then(() => {
                    // set the results
                    req.session.messageType = 'success';
                    req.session.message = paymentMessage;
                    req.session.paymentEmailAddr = order.orderEmail;
                    req.session.paymentApproved = paymentApproved;
                    req.session.paymentDetails = paymentDetails;

                    var paymentResults = {
                        message: req.session.message,
                        messageType: req.session.messageType,
                        paymentEmailAddr: req.session.paymentEmailAddr,
                        paymentApproved: req.session.paymentApproved,
                        paymentDetails: req.session.paymentDetails
                    };

                    if(req.session.isRebuild) {
                      paymentResults.greeting = {
                        title: "Thanks for buying a Kala lamp!",
                        message: "We will shortly send you an email when your Kala lamp is being crafted"
                      }
                    } else {
                      paymentResults.greeting = {
                        title: "Thanks for buying a Kala lamp!",
                        message: "We hope you find joyful the light from your new Kala"
                      }
                    }

                    // send the email with the confirmation
                    console.log("Sending email to ", req.session.paymentEmailAddr)
                    common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.renderPaymentEmail(paymentResults, cart));
                    console.log("Sent")

                    // clear the cart
                    if(req.session.cart){
                        req.session.cart = null;
                        req.session.orderId = null;
                        req.session.totalCartAmount = 0;
                        common.emptyCart(req, res, 'silent');
                    }

                    res.redirect('/payment/' + order._id);
                });
            });
        });
    });
});

router.post('/checkout_action', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paypalConfig = common.getPaymentConfig();

    console.log("checkout_action", req.session)
    const items = productsToItems(req.session, paypalConfig)
    // setup the payment object
    const payment = {
        intent: 'sale',
        payer: {
            payment_method: 'paypal'
        },
        redirect_urls: {
            return_url: config.baseUrl + '/paypal/checkout_return',
            cancel_url: config.baseUrl + '/paypal/checkout_cancel'
        },
        transactions: [{
            item_list: { 
              items: items,
            },
            amount: {
                total: req.session.totalCartAmount,
                currency: paypalConfig.paypalCurrency
            },
            description: renderDescrption(req.session.cart)
        }]
    };

    // set the config
    paypal.configure(paypalConfig);

    // create payment
    paypal.payment.create(payment, (error, payment) => {
        if(error){
          console.log(error)
            req.session.message = 'There was an error processing your payment. You have not been changed and can try again.';
            req.session.messageType = 'danger';
            res.redirect('/pay');
            return;
        }
        if(payment.payer.payment_method === 'paypal'){
            req.session.paymentId = payment.id;
            let redirectUrl, rebuild;
            for(let i = 0; i < payment.links.length; i++){
                const link = payment.links[i];
                if(link.method === 'REDIRECT'){
                    redirectUrl = link.href;
                }
            }

            // if there is no items in the cart then render a failure
            if(!req.session.cart){
                req.session.message = 'The are no items in your cart. Please add some items before checking out';
                req.session.messageType = 'danger';
                res.redirect('/');
                return;
            }

            // new order doc
            const orderDoc = {
                orderPaymentId: payment.id,
                orderPaymentGateway: 'Paypal',
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
                orderStatus: payment.state,
                orderDate: new Date(),
                orderProducts: req.session.cart
            };

            if(req.session.orderId){
                // we have an order ID (probably from a failed/cancelled payment previosuly) so lets use that.
                
                if(req.session.isRebuild) {
                  // assign order to rebuild
                  db.rebuilds.updateOne({_id: common.getId(req.session.rebuildId)}, {$set: {
                    orderId: common.getId(req.session.orderId),
                    status: translateToRebuildStatus(payment.state)
                  }}, {upsert: true})
                }

                // send the order to Paypal
                res.redirect(redirectUrl);
            } else{
                // no order ID so we create a new one
                db.orders.insertOne(orderDoc, (err, newDoc) => {
                    if(err){
                        console.info(err.stack);
                    }

                    // get the new ID
                    const newId = newDoc.insertedId;

                    // set the order ID in the session
                    req.session.orderId = newId;

                    if(req.session.isRebuild) {
                      // assign order to rebuild
                      db.rebuilds.updateOne({_id: common.getId(req.session.rebuildId)}, {$set: {
                        orderId: common.getId(req.session.orderId),
                        status: translateToRebuildStatus(payment.state)
                      }}, {upsert: true})
                    }

                    // send the order to Paypal
                    res.redirect(redirectUrl);
                });
            }
        }
    });
});

module.exports = router;
