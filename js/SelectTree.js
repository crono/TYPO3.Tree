/*
 * This file is part of the TYPO3 CMS project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */


define(['d3', 'SvgTree'], function (d3, SvgTree) {
    'use strict';

    /**
     * @constructor
     * @exports TYPO3/CMS/Backend/FormEngine/Element/SelectTree
     */
    var SelectTree = function () {
        SvgTree.call(this);
        this.settings.showCheckboxes = true;
    };

    SelectTree.prototype = Object.create(SvgTree.prototype);
    var _super_ = SvgTree.prototype;

    /**
     * SelectTree initialization
     *
     * @param {String} selector
     * @param {Object} settings
     */
    SelectTree.prototype.initialize = function (selector, settings) {
        _super_.initialize.call(this, selector, settings);

        this.addIcons();
        this.dispatch.on('updateNodes.selectTree', this.updateNodes);
        this.dispatch.on('loadDataAfter.selectTree', this.loadDataAfter);
        this.dispatch.on('updateSvg.selectTree', this.renderCheckbox);
        this.dispatch.on('nodeSelectedAfter.selectTree', this.nodeSelectedAfter);
    };

    /**
     * Function relays on node.indeterminate state being up to date
     *
     * @param {Selection} nodeSelection
     */
    SelectTree.prototype.updateNodes = function (nodeSelection) {
        var me = this;
        if (this.settings.showCheckboxes) {
            nodeSelection
                .selectAll('.tree-check use')
                .attr('visibility', function (node) {
                    var checked = Boolean(node.data.checked);
                    if (d3.select(this).classed('icon-checked') && checked) {
                        return 'visible';
                    } else if (d3.select(this).classed('icon-indeterminate') && node.indeterminate && !checked) {
                        return 'visible';
                    } else if (d3.select(this).classed('icon-check') && !node.indeterminate && !checked) {
                        return 'visible';
                    } else {
                        return 'hidden';
                    }
                });
        }
    };

    /**
     * Adds svg elements for checkbox rendering.
     *
     * @param {Selection} nodeSelection ENTER selection (only new DOM objects)
     */
    SelectTree.prototype.renderCheckbox = function (nodeSelection) {
        var me = this;
        if (this.settings.showCheckboxes) {
            this.textPosition = 50;
            //this can be simplified to single "use" element with changing href on click when we drop IE11 on WIN7 support
            var g = nodeSelection.filter(function (node) {
                    //do not render checkbox if node is not selectable
                    return me.isNodeSelectable(node) || Boolean(node.data.checked);
                })
                .append('g')
                .attr('class', 'tree-check')
                .on('click', function (d) {
                    me.selectNode(d);
                });
            g.append('use')
                .attr('x', 28)
                .attr('y', -8)
                .attr('visibility', 'hidden')
                .attr('class', 'icon-check')
                .attr('xlink:href', '#icon-check');
            g.append('use')
                .attr('x', 28)
                .attr('y', -8)
                .attr('visibility', 'hidden')
                .attr('class', 'icon-checked')
                .attr('xlink:href', '#icon-checked');
            g.append('use')
                .attr('x', 28)
                .attr('y', -8)
                .attr('visibility', 'hidden')
                .attr('class', 'icon-indeterminate')
                .attr('xlink:href', '#icon-indeterminate');
        }
    };

    /**
     * Does not modify the data, just checking with early return
     *
     * @param {Node} node
     */
    SelectTree.prototype.hasCheckedOrIndeterminateChildren = function (node) {
        if (!node.children) {
            return false;
        }

        return node.children.some(function (child) {
            if (child.data.checked || child.indeterminate) {
                return true;
            }
        });
    };

    /**
     * Updates the indeterminate state for ancestors of the current node
     *
     * @param {Node} node
     */
    SelectTree.prototype.updateAncestorsIndetermineState = function (node) {
        var me = this;
        //foreach ancestor except node itself
        node.ancestors().slice(1).forEach(function (n) {
            n.indeterminate = (node.data.checked || node.indeterminate) ? true : me.hasCheckedOrIndeterminateChildren(n);
        });
    };


    /**
     * Resets the node.indeterminate for the whole tree
     * It's done once after loading data. Later indeterminate state is updated just for the subset of nodes
     */
    SelectTree.prototype.loadDataAfter = function () {
        this.rootNode.each(function (node) {
            node.indeterminate = false;
        });
        this.calculateIndeterminate(this.rootNode);
    };

    /**
     * Sets indeterminate state for a subtree. It relays on the tree to have indeterminate state reset beforehand.
     *
     * @param {Node} node
     */
    SelectTree.prototype.calculateIndeterminate = function (node) {
        if (!node.children) {
            node.indeterminate = false;
            return;
        }

        node.eachAfter(function (n) {
            if ((n.data.checked || n.indeterminate) && n.parent) {
                n.parent.indeterminate = true;
            }
        })
    };


    /**
     * @param {Node} node
     */
    SelectTree.prototype.updateTextNode = function (node) {
        return _super_.updateTextNode.call(this, node) + (this.settings.showCheckboxes && node.data.checked ? ' (checked)' : '') + ( node.indeterminate ? ' (indeterminate)' : '');
    };

    /**
     * Observer for the selectedNode event
     *
     * @param {Node} node
     */
    SelectTree.prototype.nodeSelectedAfter = function (node) {
        this.updateAncestorsIndetermineState(node);
        this.saveCheckboxes(node);
    };

    /**
     * Sets a comma-separated list of selected nodes identifiers to configured input
     *
     * @param {Node} node
     */
    SelectTree.prototype.saveCheckboxes = function (node) {
        if (typeof this.settings.inputName !== 'undefined') {
            var selectedNodes = this.getSelectedNodes();

            d3
                .select(this.settings.inputName)
                .property('value', selectedNodes.map(function (d) {
                    return d.data.identifier
                }));
        }
    };

    /**
     * Add icons imitating checkboxes
     */
    SelectTree.prototype.addIcons = function () {

        var iconsData = [
            {
                identifier: 'icon-check',
                icon: '<g width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
                '<rect height="16" width="16" fill="transparent"></rect><path transform="scale(0.01)" d="M1312 256h-832q-66 0-113 47t-47 113v832q0 66 47 113t113 47h832q66 0 113-47t47-113v-832q0-66-47-113t-113-47zm288 160v832q0 119-84.5 203.5t-203.5 84.5h-832q-119 0-203.5-84.5t-84.5-203.5v-832q0-119 84.5-203.5t203.5-84.5h832q119 0 203.5 84.5t84.5 203.5z"></path></g>'
            },
            {
                identifier: 'icon-checked',
                icon: '<g width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect height="16" width="16" fill="transparent"></rect><path transform="scale(0.01)" d="M813 1299l614-614q19-19 19-45t-19-45l-102-102q-19-19-45-19t-45 19l-467 467-211-211q-19-19-45-19t-45 19l-102 102q-19 19-19 45t19 45l358 358q19 19 45 19t45-19zm851-883v960q0 119-84.5 203.5t-203.5 84.5h-960q-119 0-203.5-84.5t-84.5-203.5v-960q0-119 84.5-203.5t203.5-84.5h960q119 0 203.5 84.5t84.5 203.5z"></path></g>'
            },
            {
                identifier: 'icon-indeterminate',
                icon: '<g width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect height="16" width="16" fill="transparent"></rect><path transform="scale(0.01)" d="M1344 800v64q0 14-9 23t-23 9h-832q-14 0-23-9t-9-23v-64q0-14 9-23t23-9h832q14 0 23 9t9 23zm128 448v-832q0-66-47-113t-113-47h-832q-66 0-113 47t-47 113v832q0 66 47 113t113 47h832q66 0 113-47t47-113zm128-832v832q0 119-84.5 203.5t-203.5 84.5h-832q-119 0-203.5-84.5t-84.5-203.5v-832q0-119 84.5-203.5t203.5-84.5h832q119 0 203.5 84.5t84.5 203.5z"></path></g>'
            }
        ];

        var icons = this.iconsContainer
            .selectAll('.icon-def')
            .data(iconsData);
        icons
            .enter()
            .append('g')
            .attr('class', 'icon-def')
            .attr('id', function (i) {
                return i.identifier;
            })
            .append(function (i) {
                //workaround for IE11 where you can't simply call .html(content) on svg
                var parser = new DOMParser();
                var dom = parser.parseFromString(i.icon, "image/svg+xml");
                return dom.documentElement;
            });

    };

    return SelectTree;
});
