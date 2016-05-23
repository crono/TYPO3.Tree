

define(['jquery', 'd3', 'FastClick', 'underscore'], function($, d3, FastClick, _) {
    'use strict';

    function SVGTree(){
        this.settings = {
            showCheckboxes: false,
            showIcons: false,
            nodeHeight: 20,
            indentWidth: 16,
            duration: 400,
            dataUrl: 'tree-configuration.json'
        };

        this.viewportHeight = 0;
        this.scrollTop = 0;
        this.scrollHeight = 0;
        this.scrollBottom = 0;
        this.tree = null;
        this.svg = null;
        this.iconElements = null;
        this.dragElement = null;
        this.container = null;
        this.linkElements = null;
        this.nodeElements = null;
        this.drag = null;
        this.root = null;
        this.lastDragY = null;
        this.throttledDragmove = null;
        this.data = {};
        this.visibleRows = 0;
        this.position = 0;
        this.visibleNodesCount = 0;
    }

    SVGTree.prototype = {
        constructor: SVGTree,

        initialize: function(selector, settings) {
            $.extend(this.settings, settings);
            var me = this;

            this.tree = d3.layout.tree();
            this.svg = d3
                .select(selector)
                .append('svg')
                .attr('version', '1.1');
            this.dragElement = this.svg
                .append('rect')
                .attr('visibility', 'hidden')
                .attr('x', 0)
                .attr('y', 0)
                .style('fill', '#D6E7F7')
                .attr('width', '100%')
                .attr('height', this.settings.nodeHeight);
            this.container = this.svg
                .append('g')
                .attr('transform', 'translate(' + (this.settings.indentWidth / 2) + ',' + (this.settings.nodeHeight / 2) + ')');
            this.linkElements = this.container.append('g')
                .attr('class', 'links');
            this.nodeElements = this.container.append('g')
                .attr('class', 'nodes');
            this.drag = d3.behavior.drag()
                .origin(Object)
                .on('dragstart', this.dragstart.bind(me))
                .on('drag', this.dragmove.bind(me))
                .on('dragend', this.dragend.bind(me));

            if (this.settings.showIcons) {
                this.iconElements = this.svg.append('defs');
            }


            this.updateScrollPosition();
            this.loadData();

            $(window).on('resize scroll', function () {
                me.updateScrollPosition();
                me.update();
            });

            document.addEventListener('DOMContentLoaded', function () {
                FastClick.attach(document.querySelector(selector));
            }, false);

            this.throttledDragmove = _.throttle(function () {
                var currentRow = (Math.round(( me.lastDragY / me.settings.nodeHeight ) * 2) / 2);
                var dragElementHeight = currentRow % 1 ? 1 : me.settings.nodeHeight;
                var dragElementY = (currentRow * me.settings.nodeHeight) + (currentRow % 1 ? (me.settings.nodeHeight / 2) : 0);
                me.dragElement
                    .attr('visibility', 'visible')
                    .attr('transform', this.xy({x: 0, y: dragElementY}))
                    .attr('height', dragElementHeight);
            }, 40);


        },

        updateScrollPosition: function(){
            this.viewportHeight = parseInt(window.innerHeight);
            this.scrollTop = Math.max(0, window.pageYOffset - (this.viewportHeight / 2));
            this.scrollHeight = parseInt(window.document.body.clientHeight);
            this.scrollBottom = this.scrollTop + this.viewportHeight + (this.viewportHeight / 2);
            this.viewportHeight = this.viewportHeight * 1.5;
        },

        loadData: function(){
            var me = this;
            d3.json(this.settings.dataUrl, function (error, json) {
                if (error) throw error;
                json = me.tree.nodes(json);
                json.forEach(function(n) {
                    n.open = true;
                    n.hasChildren = (n.children || n._children) ? 1 : 0;
                    if (me.settings.showCheckboxes) {
                        n.indeterminate = me.isCheckboxIndeterminate(n);
                    }
                    n.parents = [];
                    n._isDragged = false;
                    if (n.parent) {
                        var x = n;
                        while (x && x.parent) {
                            if (x.parent.identifier) {
                                n.parents.push(x.parent.identifier);
                            }
                            x = x.parent;
                        }
                    }
                });
                me.root = json;
                me.renderData();
                me.update();
            });
        },

        isCheckboxIndeterminate: function(n) {
            /**
             * Display states for the node
             *
             * checked: node is checked
             * unchecked: node is unchecked and all children are unchecked
             * indeterminate: node is unchecked and at least one child is checked
             *
             */

            // indeterminate status already known
            if (typeof n.indeterminate === 'boolean') {
                return n.indeterminate;
            }

            // if a node has no children it cannot be indeterminate, if it is checked itself don't hide that by overlaying with indeterminate state
            if (!n.children || n.checked) {
                return false;
            }

            return this.hasCheckedChildren(n);
        },

        // recursive function to check if at least child is checked
        hasCheckedChildren: function(n) {
            var me = this;

            if (!n.children) {
                return n.checked;
            }

            var hasCheckedChildren = false;
            n.children.some(function (child) {
                hasCheckedChildren = me.hasCheckedChildren(child);
                // save child's indeterminate status to speed up detection
                child.indeterminate = (!child.children || child.checked) ? false : hasCheckedChildren;

                // return in some() skips rest if true
                return hasCheckedChildren;
            });
            return hasCheckedChildren;
        },

        renderData: function() {
            var me = this;

            var blacklist = {};
            this.root.forEach(function(node) {
                if (!node.open) {
                    blacklist[node.identifier] = true;
                }
            });
            this.data.nodes = this.root.filter(function(node) {
                return !node.parents.some(function(id) {
                    return Boolean(blacklist[id]);
                });
            });
            var iconHashes = [];
            this.data.links = [];
            this.data.icons = [];
            this.data.nodes.forEach(function(n, i) {
                delete n.children;
                n.x = n.depth * me.settings.indentWidth;
                n.y = i * me.settings.nodeHeight;
                if (n.parent) {
                    me.data.links.push({
                        source: n.parent,
                        target: n
                    });
                }
                if (!n.iconHash && me.settings.showIcons) {
                    n.iconHash = Math.abs(me.hashCode(n.icon));
                    if (iconHashes.indexOf(n.iconHash) === -1) {
                        iconHashes.push(n.iconHash);
                        me.data.icons.push({
                            identifier: n.iconHash,
                            icon: n.icon
                        });
                    }
                    delete n.icon;
                }
            });
            this.svg.attr('height', this.data.nodes.length * this.settings.nodeHeight);
        },

        update: function() {
            var me = this;
            var visibleRows = Math.ceil(this.viewportHeight / this.settings.nodeHeight + 1);
            var position = Math.floor(Math.max(this.scrollTop, 0) / this.settings.nodeHeight);
            var visibleNodes = this.data.nodes.slice(position, position + visibleRows);

            var nodes = this.nodeElements.selectAll('.node').data(visibleNodes);

            if (this.visibleRows !== visibleRows || this.position !== position || this.visibleNodesCount !== visibleNodes.length) {
                this.visibleRows = visibleRows;
                this.position = position;
                this.visibleNodesCount = visibleNodes.length;
                this.updateSVGElements(nodes);
            }

            // update
            nodes
                .attr('transform', this.xy)
                .select('text')
                .text(this.updateTextNode.bind(me));
            nodes
                .select('.toggle')
                .attr('transform', this.updateToggleTransform)
                .attr('visibility', this.updateToggleVisibility);

            if (this.settings.showIcons) {
                nodes
                    .select('use')
                    .attr('xlink:href', this.updateIconId);
            }

            if (this.settings.showCheckboxes) {
                nodes
                    .select('.check')
                    .attr('checked', this.updateCheckboxChecked)
                    .property('indeterminate', this.updateCheckboxIndeterminate);
            }

            // delete
            nodes
                .exit()
                .remove();


        },

        updateTextNode: function(node) {
            return node.name + (this.settings.showCheckboxes && node.checked ? ' (checked)' : '');
        },

        updateToggleTransform: function(node) {
            return node.open ? 'translate(8 -8) rotate(90)' : 'translate(-8 -8) rotate(0)' ;
        },

        updateToggleVisibility: function(node) {
            return node.hasChildren ? 'visible' : 'hidden';
        },

        updateIconId: function(node) {
            return '#icon-' + node.iconHash;
        },

        updateCheckboxChecked: function(node) {
            return node.checked ? 'checked' : null;
        },

        updateCheckboxIndeterminate: function(node) {
            return node.indeterminate;
        },

        updateSVGElements: function(nodes) {
            var me = this;
            var textPosition = 10;

            if(me.settings.showIcons) {
                var icons = this.iconElements
                    .selectAll('.icon-def')
                    .data(this.data.icons, function (i) {
                        return i.identifier;
                    });
                icons
                    .enter()
                    .append('g')
                    .attr('class', 'icon-def')
                    .attr('id', function (i) {
                        return 'icon-' + i.identifier;
                    })
                    .html(function (i) {
                        return i.icon.replace('<svg', '<g').replace('/svg>', '/g>');
                    });
            }
            var visibleLinks = this.data.links.filter(function(d) {
                return d.source.y <= me.scrollBottom && me.scrollTop <= d.target.y;
            });

            var links = this.linkElements
                .selectAll('.link')
                .data(visibleLinks);

            // create
            links
                .enter()
                .append('path')
                .attr('class', 'link');

            // update
            links
                .attr('d', this.squaredDiagonal.bind(me));

            // delete
            links
                .exit()
                .remove();

            // create the node elements
            var nodeEnter = nodes
                .enter()
                .append('g')
                .attr('class', 'node')
                .attr('transform', this.xy)
                .call(this.drag);

            // append the chevron element
            var chevron = nodeEnter
                .append('g')
                .attr('class', 'toggle')
                .on('click', this.chevronClick.bind(me));

            // improve usability by making the click area a 16px square
            chevron
                .append('path')
                .style('opacity', 0)
                .attr('d', 'M 0 0 L 16 0 L 16 16 L 0 16 Z');
            chevron
                .append('path')
                .attr('class', 'chevron')
                .attr('d', 'M 4 3 L 13 8 L 4 13 Z');

            // append the icon element
            if (this.settings.showIcons) {
                textPosition = 30;
                nodeEnter
                    .append('use')
                    .attr('x', 8)
                    .attr('y', -8);
            }

            if (this.settings.showCheckboxes) {
                textPosition = 45;
                // @todo Check foreignObject/checkbox support on IE/Edge
                // @todo Zooming the page containing the svg does not resize/reposition the checkboxes in Safari
                nodeEnter
                    .append('foreignObject')
                    .attr('x', 28)
                    .attr('y', -8)
                    .attr('width', 20)
                    .attr('height', 20)
                    .append("xhtml:div")
                    .html('<input class="check" type="checkbox">');
            }


            // append the text element
            nodeEnter
                .append('text')
                .attr('dx', textPosition)
                .attr('dy', 5);
        },

        squaredDiagonal: function(d) {
            var me = this;

            var target = {
                x: d.target._isDragged ? d.target._x : d.target.x,
                y: d.target._isDragged ? d.target._y : d.target.y
            };
            var path = [];
            path.push('M' + d.source.x + ' ' + d.source.y);
            path.push('V' + target.y);
            if (target.hasChildren) {
                path.push('H' + target.x);
            } else {
                path.push('H' + (target.x + me.settings.indentWidth / 4));
            }
            return path.join(' ');
        },

        xy: function(d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        },

        hashCode: function(s) {
            return s.split('')
                .reduce(function(a,b) {
                    a = ((a<<5)-a) + b.charCodeAt(0);
                    return a&a
                }, 0);
        },

        chevronClick: function(d) {
            if (d.open) {
                this.hideChildren(d);
            } else {
                this.showChildren(d);
            }
            this.update();
        },

        dragstart: function(d) {
            d._isDragged = true;
        },

        dragmove: function(d) {
            this.lastDragY = d3.event.y;
            this.throttledDragmove(d);
        },

        dragend: function(d) {
            d._isDragged = false;
            this.dragElement
                .attr('visibility', 'hidden');
            // var currentRow = (Math.round(( lastDragY / nodeHeight ) * 2) / 2);
            // var elementBeforePosition = Math.floor(currentRow);
            // var elementBefore = root[elementBeforePosition];
            // var elementAfter = root[elementBeforePosition + 1];
            // if (currentRow % 1) {
            //     insertBetween(elementBefore, elementAfter);
            // } else {
            //
            // }
        },

        hideChildren: function(d) {
            d.open = false;
            this.renderData();
            this.update();
        },

        showChildren: function(d) {
            d.open = true;
            this.renderData();
            this.update();
        },

        insertBetween: function(before, after) {

        }

    };

    return SVGTree;
});
