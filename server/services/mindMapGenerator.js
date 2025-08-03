// server/services/MindMapGenerator.js
const MindMapGenerator = {
    createHierarchicalMindMap(text) {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const rootLabel = lines[0].trim().replace(/[#*]/g, '');
        let nextId = 1;
        const nodes = [{
            id: 'node-0',
            data: { label: rootLabel, content: '' },
            type: 'input',
            position: { x: 250, y: 5 }
        }];
        const edges = [];
        const levels = [{ id: 'node-0', depth: 0 }];
        let currentDepth = 0;
        let parentNode = 'node-0';

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const depth = line.search(/\S|$/);
            const label = line.trim().replace(/[#*-]/g, '').trim();

            if (!label) continue;
            
            const newNodeId = `node-${nextId}`;
            nodes.push({
                id: newNodeId,
                data: { label: label, content: '' },
                type: 'default',
                position: { x: 0, y: 0 }
            });

            if (depth > currentDepth) {
                parentNode = levels[levels.length - 1].id;
                currentDepth = depth;
            } else if (depth < currentDepth) {
                const prevLevelIndex = levels.findIndex(l => l.depth === depth);
                if (prevLevelIndex !== -1) {
                    parentNode = levels[prevLevelIndex].id;
                    levels.splice(prevLevelIndex + 1);
                } else {
                    parentNode = levels[0].id;
                    currentDepth = 0;
                }
            } else {
                const prevLevelIndex = levels.findIndex(l => l.depth === depth);
                if (prevLevelIndex > 0) {
                    parentNode = levels[prevLevelIndex - 1].id;
                }
            }

            edges.push({
                id: `edge-${parentNode}-${newNodeId}`,
                source: parentNode,
                target: newNodeId
            });

            levels.push({ id: newNodeId, depth });
            nextId++;
        }
        return { nodes, edges };
    },

    createBasicMindMap(text) {
        const lines = text.split(/[\n.!?]/).filter(line => line.trim().length > 50).slice(0, 5);
        if (lines.length === 0) {
            return this.createFallbackMindMap(text);
        }
        
        let nextId = 1;
        const rootLabel = lines[0].substring(0, 50).trim() + '...';
        const nodes = [{ id: '1', data: { label: rootLabel }, position: { x: 250, y: 5 } }];
        const edges = [];

        lines.slice(1).forEach((line, index) => {
            const newNodeId = `${nextId + 1}`;
            nodes.push({
                id: newNodeId,
                data: { label: line.substring(0, 50).trim() + '...' },
                position: { x: 50 + index * 200, y: 200 }
            });
            edges.push({ id: `e1-${newNodeId}`, source: '1', target: newNodeId });
            nextId++;
        });

        return { nodes, edges };
    },

    createFallbackMindMap(text) {
        const title = text.substring(0, 50).replace(/[#\n]/g, '') || 'Document Summary';
        return {
            nodes: [{ id: '1', data: { label: title }, position: { x: 250, y: 5 } }],
            edges: []
        };
    },

    formatForReactFlow(data) {
        if (!data || !data.nodes || !data.edges) {
            throw new Error("Invalid mind map data format.");
        }
        return {
            nodes: data.nodes.map(node => ({
                ...node,
                id: node.id.toString(),
                data: {
                    ...node.data,
                    label: node.data?.label || node.label || 'Untitled'
                },
            })),
            edges: data.edges.map(edge => ({
                ...edge,
                id: edge.id.toString(),
                source: edge.source.toString(),
                target: edge.target.toString(),
                type: 'smoothstep',
                animated: true,
                style: { strokeWidth: 2, stroke: '#90caf9' },
                markerEnd: {
                    type: 'arrowclosed',
                    color: '#90caf9',
                },
            }))
        };
    }
};

module.exports = MindMapGenerator;