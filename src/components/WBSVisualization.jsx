import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  TextField,
  InputAdornment,
  Chip,
  Tooltip,
  Alert,
  Paper,
  Grid
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Search,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  FiberNew
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import useProjectStore from '../store/projectStore';
import LoadingSpinner from './LoadingSpinner';
import { BRAND_COLORS, WBS_LEVEL_COLORS } from '../constants';
import { wbsHelpers } from '../utils';

// Styled components
const TreeContainer = styled(Box)(({ theme }) => ({
  backgroundColor: BRAND_COLORS.surface,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  overflowY: 'auto',
  border: `1px solid ${BRAND_COLORS.level3}30`
}));

const TreeNodeContainer = styled(Box)(({ theme, level, isNew, isSelected }) => ({
  marginLeft: level > 1 ? theme.spacing((level - 1) * 2) : 0,
  marginBottom: theme.spacing(0.5),
  backgroundColor: isNew 
    ? `${BRAND_COLORS.accent}15` 
    : WBS_LEVEL_COLORS[level] + '10',
  borderLeft: `4px solid ${WBS_LEVEL_COLORS[level] || BRAND_COLORS.level3}`,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
  '&:hover': {
    backgroundColor: isNew 
      ? `${BRAND_COLORS.accent}25` 
      : WBS_LEVEL_COLORS[level] + '20',
    transform: 'translateX(4px)',
    boxShadow: theme.shadows[2]
  },
  ...(isSelected && {
    backgroundColor: `${BRAND_COLORS.accent}30`,
    boxShadow: theme.shadows[4]
  })
}));

const NewBadge = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  backgroundColor: BRAND_COLORS.accent,
  color: BRAND_COLORS.white,
  fontSize: '0.65rem',
  height: '20px',
  '& .MuiChip-icon': {
    fontSize: '14px'
  }
}));

const WBSVisualization = ({ 
  wbsData = null,              // ← FIXED: Added wbsData prop
  title = null,                // ← FIXED: Added title prop  
  showSearch = true,
  showNewBadges = true,
  expandAllByDefault = false,
  onNodeClick = null,
  onNodeSelect = null,
  maxHeight = '70vh'
}) => {
  // Store hooks
  const { 
    project, 
    ui, 
    toggleTreeExpansion,
    comparison 
  } = useProjectStore();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // FIXED: Use wbsData prop when provided, fall back to store data
  const wbsStructureData = wbsData || project.wbs_structure || [];

  // Build tree data from WBS structure
  const treeData = useMemo(() => {
    if (!wbsStructureData || wbsStructureData.length === 0) {  // ← FIXED: Use wbsStructureData
      return [];
    }

    try {
      // Build hierarchical tree
      const hierarchicalTree = wbsHelpers.buildHierarchicalTree(wbsStructureData);  // ← FIXED: Use wbsStructureData
      return hierarchicalTree;
    } catch (error) {
      console.error('Error building tree:', error);
      return [];
    }
  }, [wbsStructureData]);  // ← FIXED: Dependency on wbsStructureData

  // Filter tree data based on search
  const filteredTreeData = useMemo(() => {
    if (!searchTerm.trim()) {
      return treeData;
    }

    const filterTree = (nodes) => {
      return nodes.reduce((acc, node) => {
        const matchesSearch = 
          node.wbs_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.equipment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.wbs_code?.includes(searchTerm);

        const filteredChildren = node.children ? filterTree(node.children) : [];
        const hasMatchingChildren = filteredChildren.length > 0;

        if (matchesSearch || hasMatchingChildren) {
          acc.push({
            ...node,
            children: filteredChildren
          });
        }

        return acc;
      }, []);
    };

    return filterTree(treeData);
  }, [treeData, searchTerm]);

  // Tree statistics
  const treeStats = useMemo(() => {
    const flattenTree = (nodes) => {
      let flat = [];
      nodes.forEach(node => {
        flat.push(node);
        if (node.children) {
          flat = flat.concat(flattenTree(node.children));
        }
      });
      return flat;
    };

    const allNodes = flattenTree(treeData);
    const newItems = showNewBadges ? allNodes.filter(node => node.isNew) : [];
    
    return {
      totalItems: allNodes.length,
      newItems: newItems.length,
      equipmentItems: allNodes.filter(node => 
        node.wbs_name?.includes('|') && 
        !node.wbs_name?.includes('M |') && 
        !node.wbs_name?.includes('P |') && 
        !node.wbs_name?.includes('S1 |') &&
        !node.wbs_name?.includes('S2 |') &&
        !node.wbs_name?.includes('S3 |')
      ).length,
      levels: Math.max(...allNodes.map(node => node.level || 1))
    };
  }, [treeData, showNewBadges]);

  // Initialize expansion state
  useEffect(() => {
    if (expandAllByDefault && treeData.length > 0) {
      const allNodeIds = new Set();
      const collectNodeIds = (nodes) => {
        nodes.forEach(node => {
          allNodeIds.add(node.wbs_code);
          if (node.children) collectNodeIds(node.children);
        });
      };
      collectNodeIds(treeData);
      setExpandedNodes(allNodeIds);
    }
  }, [expandAllByDefault, treeData]);

  // Event handlers
  const handleNodeExpansion = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
    
    // Store state for persistence
    toggleTreeExpansion(nodeId);
  };

  const handleNodeClick = (node) => {
    setSelectedNodeId(node.wbs_code);
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Render tree node
  const renderTreeNode = (node, parentLevel = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.wbs_code);
    const isSelected = selectedNodeId === node.wbs_code;
    const nodeLevel = node.level || (parentLevel + 1);

    return (
      <Box key={node.wbs_code}>
        <TreeNodeContainer
          level={nodeLevel}
          isNew={node.isNew && showNewBadges}
          isSelected={isSelected}
          onClick={() => handleNodeClick(node)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
            {/* Expansion button */}
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeExpansion(node.wbs_code);
                }}
                sx={{ 
                  mr: 1, 
                  color: WBS_LEVEL_COLORS[nodeLevel] || BRAND_COLORS.level3,
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <ExpandMore />
              </IconButton>
            ) : (
              <Box sx={{ width: 32 }} />
            )}

            {/* Node content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: nodeLevel <= 3 ? 600 : 400,
                  color: WBS_LEVEL_COLORS[nodeLevel] || BRAND_COLORS.text,
                  fontSize: nodeLevel <= 2 ? '0.95rem' : '0.85rem',
                  wordBreak: 'break-word'
                }}
              >
                <strong>{node.wbs_code}</strong> - {node.wbs_name}
              </Typography>
              
              {node.description && (
                <Typography
                  variant="caption"
                  sx={{
                    color: BRAND_COLORS.text + '80',
                    display: 'block',
                    mt: 0.5
                  }}
                >
                  {node.description}
                </Typography>
              )}
            </Box>

            {/* NEW badge */}
            {node.isNew && showNewBadges && (
              <NewBadge
                icon={<FiberNew />}
                label="NEW"
                size="small"
              />
            )}
          </Box>
        </TreeNodeContainer>

        {/* Children */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              {node.children.map(childNode => 
                renderTreeNode(childNode, nodeLevel)
              )}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  // Render tree statistics
  const renderTreeStats = () => {
    if (treeStats.totalItems === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Paper sx={{ p: 2, backgroundColor: BRAND_COLORS.surface }}>
          <Typography variant="h6" sx={{ color: BRAND_COLORS.text, mb: 2 }}>
            {title || 'WBS Structure Overview'}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: BRAND_COLORS.accent }}>
                  {treeStats.totalItems}
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
                  Total Items
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: BRAND_COLORS.level2 }}>
                  {treeStats.equipmentItems}
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
                  Equipment Items
                </Typography>
              </Box>
            </Grid>
            
            {showNewBadges && treeStats.newItems > 0 && (
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ color: BRAND_COLORS.accent }}>
                    {treeStats.newItems}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
                    New Items
                  </Typography>
                </Box>
              </Grid>
            )}
            
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: BRAND_COLORS.level3 }}>
                  {treeStats.levels}
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
                  WBS Levels
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    );
  };

  // Handle loading state
  if (ui.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <LoadingSpinner />
      </Box>
    );
  }

  // Handle empty state  
  if (wbsStructureData.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Info sx={{ fontSize: 48, color: BRAND_COLORS.level3, mb: 2 }} />
        <Typography variant="h6" sx={{ color: BRAND_COLORS.text, mb: 1 }}>
          No WBS Structure Available
        </Typography>
        <Typography variant="body2" sx={{ color: BRAND_COLORS.text + '80' }}>
          Upload files to generate WBS structure visualization
        </Typography>
      </Box>
    );
  }

  // Handle error state
  if (treeData.length === 0 && wbsStructureData.length > 0) {  // ← FIXED: Use wbsStructureData
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="body2">
          Error building tree structure. Please check your WBS data format.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Tree statistics */}
      {renderTreeStats()}

      {/* Search bar */}
      {showSearch && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search WBS items..."
            value={searchTerm}
            onChange={handleSearchChange}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: BRAND_COLORS.level3 }} />
                </InputAdornment>
              ),
              ...(searchTerm && {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={clearSearch}>
                      <Warning />
                    </IconButton>
                  </InputAdornment>
                )
              })
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: BRAND_COLORS.level3
                },
                '&.Mui-focused fieldset': {
                  borderColor: BRAND_COLORS.accent
                }
              }
            }}
          />
        </Box>
      )}

      {/* Search results info */}
      {searchTerm && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
            {filteredTreeData.length === 0 
              ? 'No items match your search' 
              : `Showing ${filteredTreeData.length} matching item(s)`}
          </Typography>
        </Box>
      )}

      {/* Tree container */}
      <TreeContainer sx={{ maxHeight }}>
        {filteredTreeData.length > 0 ? (
          filteredTreeData.map(node => renderTreeNode(node))
        ) : searchTerm ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Search sx={{ fontSize: 48, color: BRAND_COLORS.level3, mb: 2 }} />
            <Typography variant="body2" sx={{ color: BRAND_COLORS.text }}>
              No items found matching "{searchTerm}"
            </Typography>
          </Box>
        ) : null}
      </TreeContainer>

      {/* Expansion controls */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Tooltip title="Expand All">
          <IconButton
            size="small"
            onClick={() => {
              const allNodeIds = new Set();
              const collectNodeIds = (nodes) => {
                nodes.forEach(node => {
                  allNodeIds.add(node.wbs_code);
                  if (node.children) collectNodeIds(node.children);
                });
              };
              collectNodeIds(treeData);
              setExpandedNodes(allNodeIds);
            }}
          >
            <ExpandMore />
          </IconButton>
        </Tooltip>
        <Tooltip title="Collapse All">
          <IconButton
            size="small"
            onClick={() => setExpandedNodes(new Set())}
          >
            <ChevronRight />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default WBSVisualization;
