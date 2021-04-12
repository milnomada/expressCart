/* eslint-disable prefer-arrow-callback, no-var, no-tabs */

function isNumber(evt) {
    evt = (evt) ? evt : window.event;
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        return false;
    }
    return true;
}

function deleteFromCart(element){
    $.ajax({
        method: 'DELETE',
        url: `/cart/product/${element.attr('data-id')}`
        // data: { cartId:  }
    })
    .done(function(msg){
        $('#cart-count').text(msg.totalCartItems);
        if(msg.totalCartItems === 0){
			$(element).closest('.cart-row').hide('slow', function(){
				$(element).closest('.cart-row').remove();
			});
			$('.cart-contents-shipping').hide('slow', function(){
				$('.cart-contents-shipping').remove();
			});
            showNotification(msg.message, 'success');
            setTimeout(function(){
                window.location = '/';
            }, 3700);
        }else{
			$(element).closest('.cart-row').hide('slow', function(){ $(element).closest('.cart-row').remove(); });
            showNotification(msg.message, 'success');
        }
    })
    .fail(function(msg){
        showNotification(msg.responseJSON.message, 'danger');
    });
}

function slugify(str){
    var $slug = '';
    var trimmed = $.trim(str);
    $slug = trimmed.replace(/[^a-z0-9-æøå]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'a');
    return $slug.toLowerCase();
}

function cartUpdate(element){
    if($(element).val() > 0){
        if($(element).val() !== ''){
            updateCart();
        }
    }else{
        $(element).val(1);
    }
}

function updateCart(){
    // gather items of cart
    var cartItems = [];
    $('.cart-product-quantity').each(function(){
        var item = {
            cartIndex: $(this).attr('id'),
            itemQuantity: $(this).val(),
            productId: $(this).attr('data-id')
        };
        cartItems.push(item);
    });

    // update cart on server
    $.ajax({
        method: 'POST',
        url: '/cart/update',
        data: { items: JSON.stringify(cartItems) }
    })
    .done(function(msg){
        // update cart items
        updateCartDiv();
        $('#cart-count').text(msg.totalCartItems);
    })
    .fail(function(msg){
        showNotification(msg.responseJSON.message, 'danger', true);
    });
}

function updateCartDiv(){
    // get new cart render
    var path = window.location.pathname.split('/').length > 0 ? window.location.pathname.split('/')[1] : '';
    $.ajax({
        method: 'GET',
        url: '/cart/partial',
        data: { path: path }
    })
    .done(function(msg){
        // update cart div
        $('#cart').html(msg);
    })
    .fail(function(msg){
        showNotification(msg.responseJSON.message, 'danger');
    });
}

function getSelectedOptions(){
    var options = {};
    $('.product-opt').each(function(){
        if($(this).attr('name') === 'opt-'){
            options[$(this).val().trim()] = $(this).prop('checked');
            return;
        }
        var optionValue = $(this).val().trim();
        if($(this).attr('type') === 'radio'){
            optionValue = $('input[name="' + $(this).attr('name') + '"]:checked').val();
        }
        options[$(this).attr('name').substring(4, $(this).attr('name').length)] = optionValue;
    });
    return options;
}
// show notification popup
function showNotification(msg, type, reloadPage){
    // defaults to false
    reloadPage = reloadPage || false;

    $('#notify_message').removeClass();
    $('#notify_message').addClass('alert-' + type);
    $('#notify_message').html(msg);
    $('#notify_message').slideDown(600).delay(2500).slideUp(600, function(){
        if(reloadPage === true){
            location.reload();
        }
    });
}

$(document).ready(function(){
    var productId = $('.product-details').attr('data-id'),
        imageCount = parseInt($('.product-details').attr('data-sz')),
        pad;

    console.log(productId, imageCount)
    
    /**
     * 360 Viewer 
     * 
     */
    var sliderStatus = {
      baseIndex: 1,
      current: "url(/uploads/" + productId + "/kala1-2-360-01.jpg)",
    }

    for(var i = 1; i < imageCount + 1; i++) {
      $('.thumbnail-image-container').append('<div class="over over-' + i + '"></div>')
    }
    
    setTimeout(function(){
      for(var i = 1; i < imageCount + 1; i++) {
        if(i < 10)
          pad = "0" + i
        else
          pad = i
        $('.over-' + i).css({"background-image": "url(/uploads/" + productId + "/kala1-2-360-" + pad + ".jpg?v=" + i + ")"})
      }
    }, 133)

    console.log(sliderStatus.current)
    $('.thumbnail-image-container').css({"background-image": sliderStatus.current})

    var build360 = function(imageCount, sliderStatus) {
      var w = $('body').width(),
          radiux;

      if(w >= 1920) {
        radiux = 100
      } else if(w >= 1440) {
        radiux = 75
      } else if(w >= 1200) {
        radiux = 70
      } else if(w >= 900) {
        radiux = 65
      } else {
        radiux = 65
      }
      // position the slider in the center, biased by radiux
      $("#slider").css({left: 'calc(50% - ' + radiux + 'px'});
      $("#slider").roundSlider({
        editableTooltip: false,
        showTooltip: false,
        min: 1,
        max: 100,
        startAngle: 270,
        width: 2,
        radius: radiux,
        handleSize: 20,
        create: function(){
          // if(!$('.rs-container').find('.rs-tooltip-text')) {
          $('.rs-container').append('<span class="rs-tooltip rs-tooltip-text" style="margin-top: -10px; margin-left: -5.13281px;">0&deg;</span>')
          //}
        },
        change: function (e) {
          // 28 - 100
          // x  -  v
          x = (imageCount * e.value) / 100
          // $('.thumbnail-image-container').css({"background-image": "url(/uploads/5dd5f4f672d9f772f54b5c03/kala1-2-360-" + parseInt(x) + ".jpg?v=" + e.value + ")"})
          console.log(e.value);
        },
        drag: function (e) {
          var x = (imageCount * e.value) / 100,
              w,
              deg = parseInt((360 * e.value) / 100);

          console.log(parseInt(x));
          // update only if the relative radial offset changed the picture
          if(parseInt(x) > 0 && parseInt(x) !== sliderStatus.currentIndex) {
            sliderStatus.currentIndex = parseInt(x)
            if(sliderStatus.currentIndex === imageCount) {
              deg = 0
            }
            $('.over-' + sliderStatus.currentIndex).show()
            $('.over:not(.over-' + sliderStatus.currentIndex + ")").hide()
            $('.thumbnail-image-container').css({"background-image": "none"}) // disable background
          } else if(parseInt(x) === 0) {
            $('.over-1').show()
            $('.over:not(.over-1)').hide()
          }

          // always update degrees
          $('.rs-tooltip-text').html(deg + "&deg;");
          w = $('.rs-tooltip-text').width()
          $('.rs-tooltip-text').css({'margin-left': - (w/2) + 'px'});
        }
      });
    }

    build360(imageCount, sliderStatus)
    /*$('#slider').css({
      top: "-" + ((70 * ((100 * w) / (1920))) / 100) + "px",
      left: "calc(50% - " + ((100 * w) / (1920)) + "px)"
    })*/

    /**
     * cc logic
     * Credit card form format as it types
     */
  
    var ccNumUpdate = false;

    $('.form-check-input').on('click', function(e){
      console.log(e, e.target)
      var paymentMode = $(e.target).val()
      if(e.target.checked) {
        switch(paymentMode){
          case 'card':
            $('.payment-details[data-type=paypal]').slideUp(400, function(){
              $('.payment-details[data-type=card]').slideDown()  
            })
            break;
          case 'paypal':
            $('.payment-details[data-type=card]').slideUp(400, function(){
              $('.payment-details[data-type=paypal]').slideDown()  
            })
            break;
        }
      } else {
        switch(paymentMode){
          case 'card':
            $('.payment-details[data-type=card]').slideUp()
            break;
          case 'paypal':
            $('.payment-details[data-type=card]').slideUp()
            break;
        }
      }
    })

    $('.cc-number').on('keypress', function(e){
      var n;
      if(isNumber(e)) {
        n = $(this).val().replace(/\s/g,'').length
        if(n == 20) 
          return false;
        if($(this).val().length > 0 && n % 4 === 0) {
          $(this).val( $(this).val() + " ")
        }

      } else {
        return false
      }
    })

    $('.cc-expires').on('keypress', function(e){
      var n;
      if(isNumber(e)) {
        n = $(this).val().replace(/\s/g,'').replace(/\//g,'').length
        if(n == 6) 
          return false;
        if(n == 2) {
          $(this).val( $(this).val().replace(/\s/g,'').replace(/\//g,'') + " / ")
        } else if(n < 2) {
          $(this).val( $(this).val().replace(/\s/g,'').replace(/\//g,'') )
        }

      } else {
        return false
      }
    })

    $('.cc-cvc').on('keypress', function(e){
      var n;
      if(isNumber(e)) {
        n = $(this).val().replace(/\s/g,'').replace(/\//g,'').length
        if(n == 3) 
          return false;
      } else {
        // $(this).val( $(this).val().slice(0, $(this).val().length-2) )
        return false
      }
    })

    /*
    var lastScrollTop = 0, active = false;
    $(window).on('scroll', function(event) {
      if(active)
        return
      active = true
      var st = $(this).scrollTop();
      if (st > lastScrollTop) {
        $('html, body').animate({
            scrollTop: $('.footer').offset().top
        }, {duration: 200, easing: 'linear', done: function(){ active = false}});
      } else {
        $('html, body').animate({
            scrollTop: $('body').offset().top
        }, {duration: 200, easing: 'linear', done: function(){ active = false}});
      }
      lastScrollTop = st;
    });
    */
    
    $(window).on('resize', function(){
      build360(imageCount, sliderStatus)
    })

    // setup if material theme
    if($('#cartTheme').val() === 'Material'){
        $('.materialboxed').materialbox();
    }

    if($(window).width() < 768){
        $('.menu-side').on('click', function(e){
            e.preventDefault();
            $('.menu-side li:not(".active")').slideToggle();
        });

        $('.menu-side li:not(".active")').hide();
        $('.menu-side>.active').html('<i class="fa fa-bars" aria-hidden="true"></i>');
        $('.menu-side>.active').addClass('menu-side-mobile');

        // hide menu if there are no items in it
        if($('#navbar ul li').length === 0){
            $('#navbar').hide();
        }

        $('#offcanvasClose').hide();
    }

    $('.shipping-form input').each(function(e){
        $(this).wrap('<fieldset></fieldset>');
        var tag = $(this).attr('placeholder');
        var name = $(this).attr('name');
        console.log(name)
        $(this).after('<label for="' + name + '" class="hidden">' + tag + '</label>');
    });

    $('.shipping-form input').on('focus', function(){
        $(this).next().addClass('floatLabel');
        $(this).next().removeClass('hidden');
    });

    $('.shipping-form input').on('blur', function(){
        if($(this).val() === ''){
            $(this).next().addClass('hidden');
            $(this).next().removeClass('floatLabel');
        }
    });

    $('.menu-btn:not(.lang)').on('click', function(e){
        e.preventDefault();
    });

    $('#checkout_paypal').on('click', function(){
      if($('#shipping-form').validator('validate').has('.has-error').length === 0){
        $('.payment-action').html('Redirecting <i class="fa fa-refresh fa-spin"></i>')  
      }
      $('#shipping-form').submit();
      
    })

    $('#sendTestEmail').on('click', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/testEmail'
		    })
		    .done(function(msg){
            showNotification(msg, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    if($('#footerHtml').length){
        var footerHTML = window.CodeMirror.fromTextArea(document.getElementById('footerHtml'), {
            mode: 'xml',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true,
            htmlMode: true,
            fixedGutter: false
        });

        footerHTML.setValue(footerHTML.getValue());
    }

    if($('#googleAnalytics').length){
        window.CodeMirror.fromTextArea(document.getElementById('googleAnalytics'), {
            mode: 'xml',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true,
            htmlMode: true,
            fixedGutter: false
        });
    }
    // disable custom css
    /* if($('#customCss').length){
        var customCss = window.CodeMirror.fromTextArea(document.getElementById('customCss'), {
            mode: 'text/css',
            tabMode: 'indent',
            theme: 'flatly',
            lineNumbers: true
        });

        var customCssBeautified = window.cssbeautify(customCss.getValue(), {
            indent: '   ',
            autosemicolon: true
        });
        customCss.setValue(customCssBeautified);
    } */

	  // add the table class to all tables
    $('table').each(function(){
        $(this).addClass('table table-hover');
    });

    $('#productTags').tokenfield();

    $(document).on('click', '.dashboard_list', function(e){
        window.document.location = $(this).attr('href');
    }).hover(function(){
        $(this).toggleClass('hover');
    });

    $('.product-title').dotdotdot({
        ellipsis: '...'
    });

	// Call to API for a change to the published state of a product
    $('input[class="published_state"]').change(function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/published_state',
            data: { id: this.id, state: this.checked }
        })
		    .done(function(msg){
            showNotification(msg.message, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.btn-qty-minus', function(e){
        var qtyElement = $(e.target).parent().parent().find('.cart-product-quantity');
        $(qtyElement).val(parseInt(qtyElement.val()) - 1);
        cartUpdate(qtyElement);
    });

    $(document).on('click', '.btn-qty-add', function(e){
        var qtyElement = $(e.target).parent().parent().find('.cart-product-quantity');
        $(qtyElement).val(parseInt(qtyElement.val()) + 1);
        cartUpdate(qtyElement);
    });

    $(document).on('change', '.cart-product-quantity', function (e){
        cartUpdate(e.target);
    });

    $(document).on('click', '.btn-delete-from-cart', function(e){
        deleteFromCart($(e.target));
    });

    $(document).on('click', '.orderFilterByStatus', function(e){
        e.preventDefault();
        window.location = '/admin/orders/bystatus/' + $('#orderStatusFilter').val();
    });

    /**
     * Callback for page.
     * See:
     * https://botmonster.com/jquery-bootpag/#example-advanced
     */
    const onPageCallback = function(e, n) {
      console.log(e, n);
    }

    var pageLen = $('#productsPerPage').val();
    var productCount = $('#totalProductCount').val();
    var paginateUrl = $('#paginateUrl').val();
    var searchTerm = $('#searchTerm').val();
    var pagerHref = '/' + paginateUrl + '/' + searchTerm + '{{number}}';
    var totalProducts = Math.ceil(productCount / pageLen);

    console.log($('.kala-links li').get($('#pageNum').val()))
    var index = ($('#pageNum').val() || 1) - 1;
    var elem = $('.kala-links li').get(index);
    $(elem).find('a').addClass('selected')

    /* if($('#pager').length){
      var pageNum = $('#pageNum').val();
      var pageLen = $('#productsPerPage').val();
      var productCount = $('#totalProductCount').val();
      var paginateUrl = $('#paginateUrl').val();
      var searchTerm = $('#searchTerm').val();

      if(searchTerm !== ''){
        searchTerm = searchTerm + '/';
      }

      var pagerHref = '/' + paginateUrl + '/' + searchTerm + '{{number}}';
      var totalProducts = Math.ceil(productCount / pageLen);

      if(parseInt(productCount) > parseInt(pageLen)){
        $('#pager').bootpag({
          total: totalProducts,
          page: pageNum,
          maxVisible: 5,
          href: pagerHref,
          wrapClass: 'pagination',
          prevClass: 'waves-effect',
          nextClass: 'waves-effect',
          activeClass: 'pag-active waves-effect'
        }).on('page', onPageCallback)
      }
    } */
 
    $(document).on('click', '#btnPageUpdate', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/settings/pages/update',
            data: {
                page_id: $('#page_id').val(),
                pageName: $('#pageName').val(),
                pageSlug: $('#pageSlug').val(),
                pageEnabled: $('#pageEnabled').is(':checked'),
                pageContent: $('#pageContent').val()
            }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#btnGenerateAPIkey', function(e){
        e.preventDefault();
        $.ajax({
            method: 'POST',
            url: '/admin/createApiKey'
		    })
		    .done(function(msg){
            $('#apiKey').val(msg.apiKey);
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.product_opt_remove', function(e){
        e.preventDefault();
        var name = $(this).closest('li').find('.opt-name').html();

        $.ajax({
            method: 'POST',
            url: '/admin/product/removeoption',
            data: { productId: $('#productId').val(), optName: name }
        })
        .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '#product_opt_add', function(e){
        e.preventDefault();

        var optName = $('#product_optName').val();
        var optLabel = $('#product_optLabel').val();
        var optType = $('#product_optType').val();
        var optOptions = $('#product_optOptions').val();

        var optJson = {};
        if($('#productOptions').val() !== '' && $('#productOptions').val() !== '"{}"'){
            optJson = JSON.parse($('#productOptions').val());
        }

        var html = '<li class="list-group-item">';
        html += '<div class="row">';
        html += '<div class="col-lg-2 opt-name">' + optName + '</div>';
        html += '<div class="col-lg-2">' + optLabel + '</div>';
        html += '<div class="col-lg-2">' + optType + '</div>';
        html += '<div class="col-lg-4">' + optOptions + '</div>';
        html += '<div class="col-lg-2 text-right">';
        html += '<button class="product_opt_remove btn btn-danger btn-sm">Remove</button>';
        html += '</div></div></li>';

        // append data
        $('#product_opt_wrapper').append(html);

        // add to the stored json string
        optJson[optName] = {
            optName: optName,
            optLabel: optLabel,
            optType: optType,
            optOptions: $.grep(optOptions.split(','), function(n){ return n === 0 || n; })
        };

        // write new json back to field
        $('#productOptions').val(JSON.stringify(optJson));

        // clear inputs
        $('#product_optName').val('');
        $('#product_optLabel').val('');
        $('#product_optOptions').val('');
    });

    // validate form and show stripe payment
    $('#stripeButton').validator().on('click', function(e){
        e.preventDefault();
        if($('#shipping-form').validator('validate').has('.has-error').length === 0){
            // if no form validation errors
            var handler = window.StripeCheckout.configure({
                key: $('#stripeButton').data('key'),
                image: $('#stripeButton').data('image'),
                locale: 'auto',
                token: function(token){
                    if($('#stripeButton').data('subscription')){
                        $('#shipping-form').append('<input type="hidden" name="stripePlan" value="' + $('#stripeButton').data('subscription') + '" />');
                    }
                    $('#shipping-form').append('<input type="hidden" name="stripeToken" value="' + token.id + '" />');
                    $('#shipping-form').submit();
                }
            });

            // open the stripe payment form
            handler.open({
                email: $('#stripeButton').data('email'),
                name: $('#stripeButton').data('name'),
                description: $('#stripeButton').data('description'),
                zipCode: $('#stripeButton').data('zipCode'),
                amount: $('#stripeButton').data('amount'),
                currency: $('#stripeButton').data('currency'),
                subscription: $('#stripeButton').data('subscription')
            });
        }
    });

    if($('#adyen-dropin').length > 0){
        $.ajax({
            method: 'POST',
            url: '/adyen/setup'
        })
        .done(function(response){
            const configuration = {
                locale: 'en-AU',
                environment: response.environment.toLowerCase(),
                originKey: response.publicKey,
                paymentMethodsResponse: response.paymentsResponse
            };
            const checkout = new AdyenCheckout(configuration);
            checkout
            .create('dropin', {
                paymentMethodsConfiguration: {
                    card: {
                        hasHolderName: false,
                        holderNameRequired: false,
                        enableStoreDetails: false,
                        groupTypes: ['mc', 'visa'],
                        name: 'Credit or debit card'
                    }
                },
                onSubmit: (state, dropin) => {
                    if($('#shipping-form').validator('validate').has('.has-error').length === 0){
                        $.ajax({
                            type: 'POST',
                            url: '/adyen/checkout_action',
                            data: {
                                shipEmail: $('#shipEmail').val(),
                                shipFirstname: $('#shipFirstname').val(),
                                shipLastname: $('#shipLastname').val(),
                                shipAddr1: $('#shipAddr1').val(),
                                shipAddr2: $('#shipAddr2').val(),
                                shipCountry: $('#shipCountry').val(),
                                shipState: $('#shipState').val(),
                                shipPostcode: $('#shipPostcode').val(),
                                shipPhoneNumber: $('#shipPhoneNumber').val(),
                                payment: JSON.stringify(state.data.paymentMethod)
                            }
                        }).done((response) => {
                            window.location = '/payment/' + response.paymentId;
                        }).fail((response) => {
                            console.log('Response', response);
                            showNotification('Failed to complete transaction', 'danger', true);
                        });
                    }
                }
            })
            .mount('#adyen-dropin');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    };

    // call update settings API
    $('#settingsForm').validator().on('submit', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            // set hidden elements from codemirror editors
            // $('#footerHtml_input').val($('.CodeMirror')[0].CodeMirror.getValue());
            // $('#googleAnalytics_input').val($('.CodeMirror')[1].CodeMirror.getValue());
            // $('#customCss_input').val($('.CodeMirror')[2].CodeMirror.getValue());
            $.ajax({
                method: 'POST',
                url: '/admin/settings/update',
                data: $('#settingsForm').serialize()
            })
            .done(function(msg){
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $('#customerLogout').on('click', function(e){
        $.ajax({
            method: 'POST',
            url: '/customer/logout',
            data: {}
        })
        .done(function(msg){
            location.reload();
        });
    });

    $('#createCustomerAccount').validator().on('click', function(e){
        e.preventDefault();
        if($('#shipping-form').validator('validate').has('.has-error').length === 0){
            $.ajax({
                method: 'POST',
                url: '/customer/create',
                data: {
                    email: $('#shipEmail').val(),
                    firstName: $('#shipFirstname').val(),
                    lastName: $('#shipLastname').val(),
                    address1: $('#shipAddr1').val(),
                    address2: $('#shipAddr2').val(),
                    country: $('#shipCountry').val(),
                    state: $('#shipState').val(),
                    postcode: $('#shipPostcode').val(),
                    phone: $('#shipPhoneNumber').val(),
                    password: $('#newCustomerPassword').val()
                }
            })
            .done(function(msg){
                // Just reload to fill in the form from session
                location.reload();
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.err, 'danger');
            });
        }
    });

    $('#loginForm').on('click', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/admin/login',
                data: {
                    email: $('#email').val(),
                    password: $('#password').val()
                }
            })
            .done(function(msg){
                window.location = '/admin';
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
        e.preventDefault();
    });

    // call update settings API
    $('#customerLogin').on('click', function(e){
        if(!e.isDefaultPrevented()){
            e.preventDefault();
            $.ajax({
                method: 'POST',
                url: '/customer/login',
                data: {
                    loginEmail: $('#customerLoginEmail').val(),
                    loginPassword: $('#customerLoginPassword').val()
                }
            })
            .done(function(msg){
                var customer = msg.customer;
                // Fill in customer form
                $('#shipEmail').val(customer.email);
                $('#shipFirstname').val(customer.firstName);
                $('#shipLastname').val(customer.lastName);
                $('#shipAddr1').val(customer.address1);
                $('#shipAddr2').val(customer.address2);
                $('#shipCountry').val(customer.country);
                $('#shipState').val(customer.state);
                $('#shipPostcode').val(customer.postcode);
                $('#shipPhoneNumber').val(customer.phone);
                location.reload();
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
        e.preventDefault();
    });

    $(document).on('click', '.image-next', function(e){
        var thumbnails = $('.thumbnail-image');
        var index = 0;
        var matchedIndex = 0;

        // get the current src image and go to the next one
        $('.thumbnail-image').each(function(){
            if($('#product-title-image').attr('src') === $(this).attr('src')){
                if(index + 1 === thumbnails.length || index + 1 < 0){
                    matchedIndex = 0;
                }else{
                    matchedIndex = index + 1;
                }
            }
            index++;
        });

        // set the image src
        $('#product-title-image').attr('src', $(thumbnails).eq(matchedIndex).attr('src'));
    });

    $(document).on('click', '.image-prev', function(e){
        var thumbnails = $('.thumbnail-image');
        var index = 0;
        var matchedIndex = 0;

        // get the current src image and go to the next one
        $('.thumbnail-image').each(function(){
            if($('#product-title-image').attr('src') === $(this).attr('src')){
                if(index - 1 === thumbnails.length || index - 1 < 0){
                    matchedIndex = thumbnails.length - 1;
                }else{
                    matchedIndex = index - 1;
                }
            }
            index++;
        });

        // set the image src
        $('#product-title-image').attr('src', $(thumbnails).eq(matchedIndex).attr('src'));
    });

    $(document).on('click', '#orderStatusUpdate', function(e){
        $.ajax({
            method: 'POST',
            url: '/admin/order/statusupdate',
            data: { order_id: $('#order_id').val(), status: $('#orderStatus').val() }
        })
		    .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.product-add-to-cart', function(e){
        var productOptions = getSelectedOptions();

        if(parseInt($('#product_quantity').val()) < 0){
            $('#product_quantity').val(0);
        }

        $.ajax({
            method: 'POST',
            url: '/cart/product',
            data: {
                productId: $('#productId').val(),
                productQuantity: $('#product_quantity').val(),
                productOptions: JSON.stringify(productOptions),
                productComment: "" // $('#product_comment').val()
            }
        })
		    .done(function(msg){
            $('#cart-count').text(msg.totalCartItems);
            updateCartDiv();
            showNotification(msg.message, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $(document).on('click', '.product-rebuild', function(e){
      $('.description').slideUp()
      $('.rebuild').slideDown()
    });

    $(document).on('click', '.hide-rebuild', function(e){
      $('.description').slideDown()
      $('.rebuild').slideUp()
    });

    $(document).on('click', '.request-product-rebuild', function(e){
        var productOptions = getSelectedOptions();

        if(parseInt($('#product_quantity').val()) < 0){
            $('#product_quantity').val(0);
        }

        $.ajax({
            method: 'POST',
            url: '/product/rebuild',
            headers: {apikey: '5dd981df214b6316f134c11d'},
            data: {
                productId: $('input[name=productId]').val(),
                units: 1, // $('#product_quantity').val(),
                email: $('input[name=email]').val()
            }
        })
        .done(function(msg){
            $('#cart-count').text(msg.totalCartItems);
            updateCartDiv();
            showNotification(msg.message, 'success');
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('.cart-product-quantity').on('input', function(){
        cartUpdate();
    });

    $(document).on('click', '.pushy-link', function(e){
        $('body').removeClass('pushy-open-right');
    });

    $(document).on('click', '.add-to-cart', function(e){
        e.preventDefault()

        var productLink = '/product/' + $(this).attr('data-id');
        if($(this).attr('data-link')){
            productLink = '/product/' + $(this).attr('data-link');
        }

        if($(this).attr('data-has-options') === 'true'){
            window.location = productLink;
        } else {
            $.ajax({
                method: 'POST',
                url: '/cart/product',
                data: { productId: $(this).attr('data-id') }
            })
            .done(function(msg){
                $('#cart-count').text(msg.totalCartItems);
                updateCartDiv();
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }
    });

    $(document).on('click', '#empty-cart', function(e){
        $.ajax({
            method: 'GET',
            url: '/cart/empty',
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Content-Type", "application/json");
            }
        })
        .done(function(msg){
            $('#cart-count').text(msg.totalCartItems);
            updateCartDiv();
            showNotification(msg.message, 'success', true);
        });
    });

    // Compute quantity here
    var stock = parseInt($('.product-details').attr('data-q')),
        requested = parseInt($('#product_quantity').val())
        ;

    if(stock === requested)
      $('.qty-btn-plus').hide()

    $('.qty-btn-minus').on('click', function(){
        var number = parseInt($('#product_quantity').val()) - 1;
        $('#product_quantity').val(number > 0 ? number : 1);
        if(stock >= requested)
          $('.qty-btn-plus').show()
    });

    $('.qty-btn-plus').on('click', function(){
      requested = parseInt($('#product_quantity').val())
      if(stock > requested) {
        $('#product_quantity').val(parseInt($('#product_quantity').val()) + 1);
        requested = parseInt($('#product_quantity').val())
        if(stock === requested)
          $('.qty-btn-plus').hide()
      }
      else {
        if(stock === requested)
          $('.qty-btn-plus').hide()
      }
    });

    // product thumbnail image click
    $('.thumbnail-image').on('click', function(){
        $('#product-title-image').attr('src', $(this).attr('src'));
    });

    $('.set-as-main-image').on('click', function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/setasmainimage',
            data: { product_id: $('#productId').val(), productImage: $(this).attr('data-id') }
        })
		    .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

    $('.btn-delete-image').on('click', function(){
        $.ajax({
            method: 'POST',
            url: '/admin/product/deleteimage',
            data: { product_id: $('#productId').val(), productImage: $(this).attr('data-id') }
        })
		    .done(function(msg){
            showNotification(msg.message, 'success', true);
        })
        .fail(function(msg){
            showNotification(msg.responseJSON.message, 'danger');
        });
    });

	   // Call to API to check if a permalink is available
    $(document).on('click', '#validate_permalink', function(e){
        if($('#productPermalink').val() !== ''){
            $.ajax({
                method: 'POST',
                url: '/admin/api/validate_permalink',
                data: { permalink: $('#productPermalink').val(), docId: $('#productId').val() }
            })
            .done(function(msg){
                console.log('msg', msg);
                showNotification(msg.message, 'success');
            })
            .fail(function(msg){
                showNotification(msg.responseJSON.message, 'danger');
            });
        }else{
            showNotification('Please enter a permalink to validate', 'danger');
        }
    });

    // applies an product filter
    $(document).on('click', '#btn_product_filter', function(e){
        if($('#product_filter').val() !== ''){
            window.location.href = '/admin/products/filter/' + $('#product_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // applies an order filter
    $(document).on('click', '#btn_order_filter', function(e){
        if($('#order_filter').val() !== ''){
            window.location.href = '/admin/orders/filter/' + $('#order_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // applies an product filter
    $(document).on('click', '#btn_customer_filter', function(e){
        if($('#customer_filter').val() !== ''){
            window.location.href = '/admin/customers/filter/' + $('#customer_filter').val();
        }else{
            showNotification('Please enter a keyword to filter', 'danger');
        }
    });

    // resets the order filter
    $(document).on('click', '#btn_search_reset', function(e){
        window.location.replace('/');
    });

    // search button click event
    $(document).on('click', '#btn_search', function(e){
        e.preventDefault();
        if($('#frm_search').val().trim() === ''){
            showNotification('Please enter a search value', 'danger');
        }else{
            window.location.href = '/search/' + $('#frm_search').val();
        }
    });

    // create a permalink from the product title if no permalink has already been set
    $(document).on('click', '#frm_edit_product_save', function(e){
        if($('#productPermalink').val() === '' && $('#productTitle').val() !== ''){
            $('#productPermalink').val(slugify($('#productTitle').val()));
        }

        console.log($('#uniqueProduct').attr("checked"), $('#uniqueProduct:checked'))
        if($('#uniqueProduct:checked') > 0) {
          $('#uniqueProduct').val('on')
        } else {
          $('#uniqueProduct').val('off')
        }
    });

    if($('#input_notify_message').val() !== ''){
		    // save values from inputs
        var messageVal = $('#input_notify_message').val();
        var messageTypeVal = $('#input_notify_messageType').val();

		    // clear inputs
        $('#input_notify_message').val('');
        $('#input_notify_messageType').val('');

		    // alert
        showNotification(messageVal, messageTypeVal, false);
    }
});
