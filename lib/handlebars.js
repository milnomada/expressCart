/**
 * handlebars.js
 * helpers for the handlebar templating platform
 */
const hbs = require('express-handlebars');
const moment = require('moment');
const numeral = require('numeral');


module.exports = function (i18n, config) {

    return hbs.create({
        helpers: {
            // Language helper
            __: () => { return i18n.__(this, arguments); }, // eslint-disable-line no-undef
            __n: () => { return i18n.__n(this, arguments); }, // eslint-disable-line no-undef
            availableLanguages: (block) => {
                let total = '';
                for(const lang of i18n.getLocales()){
                    total += block.fn(lang);
                }
                return total;
            },
            perRowClass: (numProducts) => {
                if(parseInt(numProducts) === 1){
                    return'col-md-12 col-xl-12 col m12 xl12 product-item';
                }
                if(parseInt(numProducts) === 2){
                    return'col-md-6 col-xl-6 col m6 xl6 product-item';
                }
                if(parseInt(numProducts) === 3){
                    return'col-md-4 col-xl-4 col m4 xl4 product-item';
                }
                if(parseInt(numProducts) === 4){
                    return'col-md-3 col-xl-3 col m3 xl3 product-item';
                }

                return'col-md-6 col-xl-6 col m6 xl6 product-item';
            },
            menuMatch: (title, search) => {
                if(!title || !search){
                    return'';
                }
                if(title.toLowerCase().startsWith(search.toLowerCase())){
                    return'class="navActive"';
                }
                return'';
            },
            getTheme: (view) => {
                return`themes/${config.theme}/${view}`;
            },
            formatAmount: (amt) => {
                if(amt){
                    return numeral(amt).format('0.00');
                }
                return'0.00';
            },
            times: (n, block) => {
                var accum = '';
                for(var i = 0; i < n; ++i) {
                    accum += block.fn(i);
                    block.data.index = i;
                    block.data.number = i + 1;
                }
                return accum;
            },
            sum: (a, b) => {
                return a + b;
            },
            amountNoDecimal: (amt) => {
                if(amt){
                    return hbs.helpers.formatAmount(amt).replace('.', '');
                }
                return hbs.helpers.formatAmount(amt);
            },
            getStatusRebuild: (status) => {
                switch(status){
                    case 0:
                    return 'created'
                    case 1:
                    return 'confirmed'
                    case 2: 
                    return 'paid'
                    case 3:
                    return 'started'
                    case 4:
                    return 'sent'
                    case 5:
                    return 'cancelled'
                }
            },
            /* getStatusColor: (status) => {
                switch(status){
                    case 3: //'Paid':
                        return 'success';
                    case 1: //'Approved':
                        return 'success';
                    case 2: //'Approved - Processing':
                        return 'success';
                    case 6: // 'Failed':
                        return 'danger';
                    case 4: //'Completed':
                        return 'success';
                    case 5: //'Shipped':
                        return 'success';
                    case 0: //'Pending':
                        return 'warning';
                    default:
                        return 'danger';
                }
            }, */
            checkProductOptions: (opts) => {
                if(opts){
                    return'true';
                }
                return'false';
            },
            currencySymbol: (value) => {
                console.log("currencySymbol", value)
                if(typeof value === 'undefined' || value === ''){
                    return'€';
                }
                return value;
            },
            objectLength: (obj) => {
                if(obj){
                    return Object.keys(obj).length;
                }
                return 0;
            },
            stringify: (obj) => {
                if(obj){
                    return JSON.stringify(obj);
                }
                return'';
            },
            checkedState: (state) => {
                if(state === 'true' || state === true){
                    return'checked';
                }
                return'';
            },
            selectState: (state, value) => {
                if(state === value){
                    return'selected';
                }
                return'';
            },
            isNull: (value, options) => {
                if(typeof value === 'undefined' || value === ''){
                    return options.fn(this);
                }
                return options.inverse(this);
            },
            toLower: (value) => {
                if(value){
                    return value.toLowerCase();
                }
                return null;
            },
            formatDate: (date, format) => {
                return moment(date).format(format);
            },
            opCalc: (v1, operator, v2) => {
            switch(operator){
                case '*': return (v1 * v2)
                case '/': return (v1 * v2)
                case '%': return (v1 - (v1/v2))
                default: return (v1 * v2)
            }
            },
            ifCond: (v1, operator, v2, options) => {
                switch(operator){
                    case'==':
                        return(v1 === v2) ? options.fn(this) : options.inverse(this);
                    case'!=':
                        return(v1 !== v2) ? options.fn(this) : options.inverse(this);
                    case'===':
                        return(v1 === v2) ? options.fn(this) : options.inverse(this);
                    case'<':
                        return(v1 < v2) ? options.fn(this) : options.inverse(this);
                    case'<=':
                        return(v1 <= v2) ? options.fn(this) : options.inverse(this);
                    case'>':
                        return(v1 > v2) ? options.fn(this) : options.inverse(this);
                    case'>=':
                        return(v1 >= v2) ? options.fn(this) : options.inverse(this);
                    case'&&':
                        return(v1 && v2) ? options.fn(this) : options.inverse(this);
                    case'||':
                        return(v1 || v2) ? options.fn(this) : options.inverse(this);
                    default:
                        return options.inverse(this);
                }
            },
            isAnAdmin: (value, options) => {
                if(value === 'true' || value === true){
                    return options.fn(this);
                }
                return options.inverse(this);
            }
        }
    })
}
