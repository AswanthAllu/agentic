// server/deep_search/routes/aiSearch.js
const express = require('express');
const router = express.Router();
const DuckDuckGoService = require('../../utils/duckduckgo');
const { GeminiService } = require('./geminiService');

const duckDuckGoService = new DuckDuckGoService();
const geminiServiceDS = new GeminiService();

router.get('/health', async (req, res) => {
    try {
        const geminiHealth = await geminiServiceDS.healthCheck();
        res.json({
            status: geminiHealth.status === 'healthy' ? 'OK' : 'DEGRADED',
            ai: geminiHealth,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.post('/', async (req, res) => {
    const logger = req.logger;
    try {
        const { query: userQuery, options = {} } = req.body;
        if (!userQuery || typeof userQuery !== 'string') {
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }

        const trimmedQuery = userQuery.trim();
        logger.log('deep_search_request', { query: trimmedQuery, userId: req.user.id });

        logger.log('query_decomposition_start', { query: trimmedQuery });
        const decomposition = await geminiServiceDS.decomposeQuery(trimmedQuery);
        logger.log('query_decomposition_success', { query: trimmedQuery, searchQueries: decomposition.searchQueries });

        logger.log('web_search_start', { queries: decomposition.searchQueries });
        const searchResults = [];
        const limitedQueries = decomposition.searchQueries.slice(0, 2);
        for (let i = 0; i < limitedQueries.length; i++) {
            const searchQuery = limitedQueries[i];
            try {
                if (i > 0) { await new Promise(resolve => setTimeout(resolve, 3000)); }
                const results = await duckDuckGoService.performSearch(searchQuery, 'text', options);
                searchResults.push({
                    query: searchQuery,
                    results: results.results || [],
                    success: !results.error && !results.rateLimited,
                    error: results.error || null,
                    rateLimited: results.rateLimited || false
                });
                if (results.results && results.results.length > 3) { break; }
            } catch (error) {
                logger.error('web_search_failed', { searchQuery, error: error.message });
                searchResults.push({ query: searchQuery, results: [], success: false, error: error.message, rateLimited: false });
            }
        }
        logger.log('web_search_completed', { resultsCount: searchResults.flatMap(sr => sr.results).length });

        logger.log('result_synthesis_start');
        let synthesis;
        const allResults = searchResults.flatMap(sr => sr.results);
        if (allResults.length > 0) {
            synthesis = await geminiServiceDS.synthesizeResults(trimmedQuery, allResults, decomposition);
        } else {
            synthesis = { answer: `I couldn't find sufficient search results for "${trimmedQuery}". Please try rephrasing your question.`, sources: [], aiGenerated: false, confidence: 0 };
        }
        logger.log('result_synthesis_success');

        const response = {
            query: trimmedQuery,
            decomposition,
            searchResults: searchResults.map(sr => ({
                query: sr.query,
                resultCount: sr.results.length,
                success: sr.success,
                ...(sr.error && { error: sr.error }),
                ...(sr.rateLimited && { rateLimited: true })
            })),
            synthesis,
            metadata: {
                totalResults: allResults.length,
                aiEnabled: geminiServiceDS.isEnabled(),
                timestamp: new Date().toISOString()
            }
        };

        logger.log('deep_search_success', { query: trimmedQuery });
        res.json(response);

    } catch (error) {
        logger.error('deep_search_failed', { error: error.message });
        res.status(500).json({ error: 'AI search failed', message: error.message, timestamp: new Date().toISOString() });
    }
});

router.get('/simple', async (req, res) => {
    const logger = req.logger;
    try {
        const { q: query } = req.query;
        if (!query) { return res.status(400).json({ error: 'Query parameter "q" is required' }); }

        logger.log('simple_search_request', { query, userId: req.user.id });
        const results = await duckDuckGoService.performSearch(query, 'text', {});
        const synthesis = await geminiServiceDS.synthesizeResults(query, results.results || [], {
            coreQuestion: query, searchQueries: [query], context: '', expectedResultTypes: ['information']
        });

        const response = {
            query: query, results: results.results || [], total: results.total || 0, synthesis, searchEngine: 'DuckDuckGo',
            aiEnabled: geminiServiceDS.isEnabled(), timestamp: new Date().toISOString()
        };

        logger.log('simple_search_success', { query });
        res.json(response);
    } catch (error) {
        logger.error('simple_search_failed', { query, error: error.message });
        res.status(500).json({ error: 'Simple AI search failed', message: error.message });
    }
});

router.post('/decompose', async (req, res) => {
    const logger = req.logger;
    try {
        const { query } = req.body;
        if (!query) { return res.status(400).json({ error: 'Query is required' }); }
        const decomposition = await geminiServiceDS.decomposeQuery(query);
        res.json({ originalQuery: query, decomposition, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('query_decompose_failed', { error: error.message });
        res.status(500).json({ error: 'Query decomposition failed', message: error.message });
    }
});

router.post('/synthesize', async (req, res) => {
    const logger = req.logger;
    try {
        const { query, results, decomposition } = req.body;
        if (!query || !results) { return res.status(400).json({ error: 'Query and results are required' }); }
        const synthesis = await geminiServiceDS.synthesizeResults(
            query, results, decomposition || { coreQuestion: query }
        );
        res.json({ query, synthesis, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('result_synthesis_failed', { error: error.message });
        res.status(500).json({ error: 'Result synthesis failed', message: error.message });
    }
});

module.exports = router;
