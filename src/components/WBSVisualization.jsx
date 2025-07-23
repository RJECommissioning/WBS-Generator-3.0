import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip,
  Paper,
  Tooltip,
  TextField,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Search,
  FiberNew,
  AccountTree,
  Description,
  Settings,
  Warning
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS, WBS_LEVEL_COLORS } from '../constants';
import { wbsHelpers, stringHelpers } from '../utils';

// Styled components with brand colors
const TreeContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxHeight: '70vh',
  overflowY: 'auto',
  border: `1px solid ${BRAND_COLORS.level2}`,
  borderRadius: theme.spacing(1),
  backgroundColor: BRAND_COLORS.white,
  padding: theme.spacing(1)
}));

const TreeNode = styled(Paper)(({ theme, level, isExpanded, isSelected, isNew }) => ({
  margin: `${theme.spacing(0.5)} 0`,
  marginLeft: theme.spacing(level * 3),
  padding: theme.spacing(1, 2),
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

  // Build tree data from WBS structure
  const treeData = useMemo(() => {
    if (!project.wbs_structure || project.wbs_structure.length === 0) {
      return [];
    }

    try {
      // Build hierarchical tree
      const hierarchicalTree = wbsHelpers.buildHierarchicalTree(project.wbs_structure);
      return hierarchicalTree;
    } catch (error) {
      console.error('Error building tree:', error);
      return [];
    }
  }, [project.wbs_structure]);

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
        
        if (matchesSearch || filteredChildren.length > 0) {
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

  // Initialize expanded nodes
  useEffect(() => {
    if (expandAllByDefault && treeData.length > 0) {
      const allNodeIds = new Set();
      
      const collectNodeIds = (nodes) => {
        nodes.forEach(node => {
          allNodeIds.add(node.wbs_code);
          if (node.children && node.children.length > 0) {
            collectNodeIds(node.children);
          }
        });
      };
      
      collectNodeIds(treeData);
      setExpandedNodes(allNodeIds);
    }
  }, [treeData, expandAllByDefault]);

  // Auto-expand nodes when searching
  useEffect(() => {
    if (searchTerm.trim() && filteredTreeData.length > 0) {
      const nodesToExpand = new Set();
      
      const expandSearchResults = (nodes) => {
        nodes.forEach(node => {
          nodesToExpand.add(node.wbs_code);
          if (node.children && node.children.length > 0) {
            expandSearchResults(node.children);
          }
        });
      };
      
      expandSearchResults(filteredTreeData);
      setExpandedNodes(prev => new Set([...prev, ...nodesToExpand]));
    }
  }, [searchTerm, filteredTreeData]);

  // Handle node expansion
  const handleToggleExpansion = (nodeId, event) => {
    event.stopPropagation();
    
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });

    // Also update store for persistence
    toggleTreeExpansion(nodeId);
  };

  // Handle node click
  const handleNodeClick = (node, event) => {
    event.stopPropagation();
    
    setSelectedNodeId(node.wbs_code);
    
    if (onNodeClick) {
      onNodeClick(node);
    }
    
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  // Handle search change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Check if node is new
  const isNodeNew = (node) => {
    return showNewBadges && (
      node.is_new === true ||
      comparison.added.some(item => item.equipment_number === node.equipment_number)
    );
  };

  // Get node icon based on type
  const getNodeIcon = (node) => {
    if (node.is_equipment) {
      return <Description fontSize="small" />;
    } else if (node.is_category) {
      return <AccountTree fontSize="small" />;
    } else {
      return <Settings fontSize="small" />;
    }
  };

  // Render individual tree node
  const renderTreeNode = (node, level = 1) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.wbs_code);
    const isSelected = selectedNodeId === node.wbs_code;
    const isNew = isNodeNew(node);

    return (
      <Box key={node.wbs_code}>
        <TreeNode
          elevation={1}
          level={level}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isNew={isNew}
          onClick={(e) => handleNodeClick(node, e)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            {/* Expansion toggle */}
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={(e) => handleToggleExpansion(node.wbs_code, e)}
                sx={{ 
                  mr: 1, 
                  color: WBS_LEVEL_COLORS[level],
                  transition: 'transform 0.2s ease',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              >
                <ChevronRight />
              </IconButton>
            ) : (
              <Box sx={{ width: 32, mr: 1 }} /> // Placeholder for alignment
            )}

            {/* Node icon */}
            <Box sx={{ mr: 1, color: WBS_LEVEL_COLORS[level] }}>
              {getNodeIcon(node)}
            </Box>

            {/* Node content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: level <= 2 ? 600 : 400,
                  color: BRAND_COLORS.text,
                  wordBreak: 'break-word'
                }}
              >
                {node.wbs_name}
              </Typography>
              
              {/* Additional info for equipment */}
              {node.equipment_number && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: BRAND_COLORS.text, 
                    opacity: 0.7,
                    display: 'block'
                  }}
                >
                  Code: {node.wbs_code} | Equipment: {node.equipment_number}
                </Typography>
              )}

              {/* Commissioning status */}
              {node.commissioning_status && node.commissioning_status !== 'Y' && (
                <Chip
                  label={node.commissioning_status}
                  size="small"
                  color={node.commissioning_status === 'TBC' ? 'warning' : 'default'}
                  sx={{ ml: 1, height: '18px', fontSize: '0.6rem' }}
                />
              )}
            </Box>

            {/* New badge */}
            {isNew && (
              <NewBadge
                label="NEW"
                size="small"
                icon={<FiberNew />}
              />
            )}
          </Box>
        </TreeNode>

        {/* Children */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout={200}>
            <Box>
              {node.children.map(child => renderTreeNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  // Render tree statistics
  const renderTreeStats = () => {
    const totalNodes = project.wbs_structure?.length || 0;
    const newNodes = comparison.added?.length || 0;
    const maxLevel = totalNodes > 0 ? Math.max(...(project.wbs_structure.map(item => item.level || 1))) : 0;

    return (
      <Box sx={{ mb: 2, p: 2, backgroundColor: `${BRAND_COLORS.level1}20`, borderRadius: 1 }}>
        <Typography variant="h6" sx={{ color: BRAND_COLORS.text, mb: 1 }}>
          WBS Structure Overview
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`${totalNodes} Total Items`} 
            color="primary" 
            size="small" 
          />
          {newNodes > 0 && (
            <Chip 
              label={`${newNodes} New Items`} 
              sx={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.white }}
              size="small" 
            />
          )}
          {maxLevel > 0 && (
            <Chip 
              label={`${maxLevel} Levels Deep`} 
              color="default" 
              size="small" 
            />
          )}
        </Box>
      </Box>
    );
  };

  // Handle empty state
  if (!project.wbs_structure || project.wbs_structure.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <AccountTree sx={{ fontSize: 48, color: BRAND_COLORS.level3, mb: 2 }} />
        <Typography variant="h6" sx={{ color: BRAND_COLORS.text, mb: 1 }}>
          No WBS Structure Available
        </Typography>
        <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
          Upload an equipment list to generate the WBS structure.
        </Typography>
      </Box>
    );
  }

  // Handle error state
  if (treeData.length === 0 && project.wbs_structure.length > 0) {
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
