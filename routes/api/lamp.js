const express = require('express');
const router = express.Router();
const { fetchProducts, fetchProduct, publicConfig } = require('../../lib/product');


router.get('/api/lamp', (req, res, next) => {

    fetchProducts(req, res, (err, data) => {
        if (err) {
            console.error(colors.red('Error getting products for page', err));
        } else {
            const { results, images } = data
            var conf = Object()
            Object.keys(publicConfig).map((k) => { conf[k] = req.app.config[k] })
            console.log(data)
            res.json({
                results: results.data,
                images: images,
                session: req.session,
                config: conf,
                productsPerPage: results.data.length,
                totalProductCount: results.totalProducts,
                pageNum: req.params.pageNum,
            });
        }
    })
});


router.get('/api/lamp/:id', (req, res, next) => {

    fetchProduct(req, res, req.params.id, (err, data) => {
        if (err) {
            console.error(colors.red(`Error getting product for id ${req.params.id}`, err));
        } else {
            var conf = Object()
            Object.keys(publicConfig).map((k) => { conf[k] = req.app.config[k] })
            console.log(data)
            res.json({
                result: data,
                session: req.session,
                config: conf
            });
        }
    })
});
