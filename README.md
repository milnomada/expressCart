# expressCart

This is a fork from [expressCart](https://github.com/mrvautin/expressCart) with few added functionalities.  

[![Github stars](https://img.shields.io/github/stars/milnomada/expressCart.svg?style=social&label=Star)](https://github.com/milnomada/expressCart)

## Installation

```bash
git clone https://github.com/milnomada/expressCart`
cd expressCart
npm i
npm start --production
```
Visit [http://127.0.0.1:1111](http://127.0.0.1:1111) in your browser

### Docker

The easiest way to get up and running is using [Docker](https://www.docker.com/get-docker).

Change `/config/settings.json` - `"dbUri": "mongodb://mongodb:27017/expresscart"`

```bash
cd expressCart
npm i
npm start --production
```
1. Enter the root of the expressCart application
2. 
3. Run: `docker-compose up --build`
4. Visit [http://127.0.0.1:1111](http://127.0.0.1:1111) in your browser

### Test Integration

Sometimes you might want some default sample/test data. To create this, run `npm run testdata`. Remember to only run this initially or anytime you want to reset the data as this function deletes ALL existing data.

## API

There is currently a limited API for certain functions of the app. Using the API can be done by firstly generating an API key via the Admin login. `Admin > My Account > API Key (Generate) button`. Once an API Key is generated it will need to be supplied in a header called `apiKey` to authenticate requests. 

## Hooks / Integrations

On the completion of a order if a `orderHook` URL is configured, expressCart will POST the data to the configured URL. This is handy or IFTTT or Zapier Webhooks where you may want to use the integration methods to retrieve the order details in other systems.

Example use might be to send all orders to a Google Docs spreadsheet or an accounting package or a packing slip software etc.

## Admin

Visit: [http://127.0.0.1:1111/admin](http://127.0.0.1:1111/admin)

A new user form will be shown where a user can be created.

## Subscriptions (Stripe only)

You are able to setup product subscriptions through Stripe. First setup the `Plan` in the [Stripe dashboard](https://dashboard.stripe.com/) then enter the Plan ID (Formatted: plan_XXXXXXXXXXXXXX) when creating or editing a product. When purchasing, a customer can only add a single subscription to their cart at one time. Subscriptions cannot be combined with other products in their cart. On Checkout/Payment the customer and subscription is created in Stripe and the billing cycle commences based on the plan setup.

##### Subscription Webhooks (Stripe only)
You are able to configure a Webhook in Stripe to receive subscription updates on successful/failed payments [here](https://dashboard.stripe.com/webhooks). The `expressCart` Webhook endpoint should be set to: `https://<example.com>/stripe/subscription_update`. You will need to set the `Events to send` value to both: `invoice.payment_failed` and `invoice.payment_succeeded`.

## Database

`expressCart` uses a MongoDB for storing all the data. Setting of the database connection string is done through the `/config/settings.json` file. There are two properties relating to the database connection:

Example MongoDB configuration:

```
{
    "dbUri": "mongodb://localhost:27017/expresscart"
}
```

## Configuration

Settings can be managed from the admin panel ([http://127.0.0.1:1111/admin](http://127.0.0.1:1111/admin)) with the exception of the Payment gateway and database settings.

All settings are stored in json files in the `/config` directory. The main application-level settings are stored in `/config/settings.json` while payment gateway settings are stored in files in the `/config` directory named after the payment gateway. For example, configuration for the Stripe payment gateway is stored in `/config/stripe.json`.

### Cart Configuration

There are several configuration attributes at  `/config/settings.json` which are used for customizing the project, search engine optimization purposes. They will be used as the title and description when your website is listed in Google and other search engines.

##### Cart Title

The `cartTitle` config attribute. It is also used if there is no logo set.

##### Cart image/logo

The `cartLogo` config attribute. Generally you would place your logo into the `/uploads` folder. You would then add the value `/uploads/mylogo.png` to the `Cart image/logo` setting value.

##### Cart URL

The `baseUrl` config attribute. This value is vital for your cart to work. Set this value to your domain name/URL which customers will access your website. This value is used in returning from Paypal
payments and the sitemap for search engine indexing.

##### Cart Email

This email is used for any email receipts which are sent by your website. The following settings need to be configured.
```json
{
    "emailHost": "smtp.host.com",
    "emailPort": 587,
    "emailSecure": false,
    "emailUser": "user@mail.com",
    "emailPassword": "somabc123b45",
    "emailAddress": "user@mail.com"
}
```

##### Free shipping threshold

The `freeShippingAmount` config attribute. ExpressCart allows for the addition of a free shipping threshold. The cart will remove the shipping costs once the order has exceeded the `Free shipping threshold`.

##### Payment Gateway

The `paymentGateway` config attribute. Determines which payment gateway to use.  
You will to include gateway configuration at `/config/${paymentGateway}.json`

##### Currency symbol

The `currencySymbol` config attribute. Set this value to your chosen currency symbol. Eg: $, £, €.

##### Themes

The `theme` config attribute.  

Themes are a set of handlebars views and a stylesheet file.
Havea look at sample themes present `/views/themes/`.
Modify the `themeViews` config attribute to set a route to theme hbs files.

##### Number of Products per page

The `productsPerPage` config attribute.

##### Number of Products per row

The `productsPerRow` config attribute.

##### Menu enabled

Enables/disable the menu setup in `/admin/settings/menu`.

##### Menu header

This is the text which will be displayed at the top of your menu.

##### Menu position

You can set position where your menu will be displayed. Setting the value to `side` will position the menu to the left of your products, setting the value to `top`
will create a 'breadcrumb' menu at the top of the page

##### Paypal (Payments)

The Paypal config file is located: `/config/paypal.json`. A example Paypal settings file is provided:

```json
{
    "mode": "live", // sandbox or live
    "client_id": "this_is_not_real",
    "client_secret": "this_is_not_real",
    "paypalCartDescription": "expressCart", // Shows as the Paypal description
    "paypalCurrency": "USD" // The Paypal currency to charge in
}
```
Note: The `client_id` and `client_secret` is obtained from your Paypal account.

##### Stripe (Payments)

The Stripe config file is located: `/config/stripe.json`. A example Stripe settings file is provided:

```json
{
    "secretKey": "sk_test_this_is_not_real",
    "publicKey": "pk_test_this_is_not_real",
    "stripeCurrency": "usd", The Stripe currency to charge in
    "stripeDescription": "expressCart payment", // Shows as the Stripe description
    "stripeLogoURL": "http://localhost:1111/images/stripelogo.png" // URL to the logo to display on Stripe form
    "stripeWebhookSecret": "whsec_this_is_not_real"
}
```

Note: The `secretKey`, `publicKey` and `stripeWebhookSecret` is obtained from your Stripe account dashboard.

##### Authorize.net (Payments)

The Authorize.net config file is located: `/config/authorizenet.json`. A example Authorize.net settings file is provided:

```json
{
    "loginId": "loginId",
    "transactionKey": "transactionKey",
    "clientKey": "clientKey",
    "mode": "test"
}
```

Note: The credentials are obtained from your Authorize.net account dashboard.

##### Adyen (Payments)

The Adyen config file is located: `/config/adyen.json`. A example Adyen settings file is provided:

```json
{
    "environment": "TEST",
    "apiKey": "this_is_not_real",
    "publicKey": "this_is_not_real",
    "merchantAccount": "this_is_not_real",
    "statementDescriptor": "a_statement_descriptor",
    "currency": "AUD"
}
```

Note: The `publicKey`, `apiKey` and `merchantAccount` is obtained from your Adyen account dashboard.

## Static pages

You may want to create a static page to show contact details, about us, shipping information etc.

New static pages are setup via `/admin/settings/pages`.

## Contributing

See [Contributing](https://github.com/mrvautin/expressCart#contributing)
