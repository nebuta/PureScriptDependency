var d3 = require('d3');
var _ = require('lodash');
var chroma = require('chroma-js');
var $ = require('jquery');

function calcSize(count) {
    return Math.max(3, 2 * Math.sqrt(count));
}

function calcColor(n) {
    var scale = chroma.scale(['blue', 'red']).domain([1, 20]).mode('lab');
    return scale(n).hex();
}

function calcDepsReverse(graph) {
    var deps = {};
    graph.links.forEach(function (d, i) {
        var from = graph.nodes[+d.source].name;
        var to = graph.nodes[+d.target].name;
        if (!(from in deps)) {
            deps[from] = [];
        }
        deps[from].push(to);
    });
    return deps;
}

function calcDeps(graph) {
    var deps = {};
    graph.links.forEach(function (d, i) {
        var from = graph.nodes[+d.source].name;
        var to = graph.nodes[+d.target].name;
        if (!(to in deps)) {
            deps[to] = [];
        }
        deps[to].push(from);
    });
    return deps;
}

var width = 800,
    height = 500;

d3.json("prep-data/list.json", function (error, graph) {
    var deps = calcDeps(graph);
    var deps_rev = calcDepsReverse(graph);

    if (error) throw error;

    var svg = d3.select("#draw_zone")
        .attr("width", width)
        .attr("height", height);

    // Place heavily used packages separately on a circle circumference.
    var popular = _.filter(graph.nodes, function (n) {
        return n.used_count >= 10;
    });
    var n = popular.length;
    popular.forEach(function (d, i) {
        d.x = width / 2 * (1 + Math.cos(Math.PI * 2 * i / n));
        d.y = height / 2 * (1 + Math.sin(Math.PI * 2 * i / n));
    });

    var force = d3.layout.force()
        .size([width, height])
        .nodes(graph.nodes)
        .links(graph.links)
        .linkDistance(function (d) {
            return Math.sqrt(d.factor) * 10;
        })
        .linkStrength(0.1)
        .charge(function (d) {
            return -50 * Math.log10(d.used_count)
        })
        .gravity(function (d) {
            return 50 / Math.log10(d.used_count);
        })
        .friction(0.9)
        .alpha(0.01)
        .start();

    var link = svg.selectAll(".link")
        .data(graph.links)
        .enter().append("line")
        .attr("class", "link")
        .style("stroke-width", function (d) {
            return Math.sqrt(d.value);
        });

    var node = svg.selectAll(".node")
        .data(graph.nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", function (d) {
            return calcSize(d.used_count)
        })
        .style("fill", function (d) {
            return calcColor(d.using_count);
        })
        .call(force.drag);

    var active_hold = false;
    node.on('mouseenter', function (d) {
        activatePackage(d);
    });
    node.on('click', function (d) {
        console.log(d);
        activatePackage(d, true);
        active_hold = true;
        d3.event.stopPropagation();
    });
    svg.on('click', function (d) {
        active_hold = false;
        deactivatePackage();
    });

    addLegend(svg);

    function activatePackage(d, force) {
        if (active_hold && !force)
            return;
        var deps_of_this = deps[d.name] || [];
        var deps_rev_of_this = deps_rev[d.name] || [];

        node.style('fill-opacity', function (d2) {
            return (d.name == d2.name ||
            deps_of_this.indexOf(d2.name) != -1 ||
            deps_rev_of_this.indexOf(d2.name) != -1) ? 1 : 0.1;
        });
        node.attr('class', function (d2) {
            return d.name == d2.name ? 'node self' :
                (deps_of_this.indexOf(d2.name) != -1) ? 'node used' :
                    (deps_rev_of_this.indexOf(d2.name) != -1) ? 'node using' : 'node other';
        });

        var ul_depends = $('<ul/>');
        _.map(deps_of_this, function (name) {
            ul_depends.append('<li>' + name + '</li>');
        });
        var info = $('#info');
        info.html('');
        info.append('<h2>' + d.name + '</h2>');
        info.append('<span>Depends on:</span>');
        info.append(ul_depends);

        var ul_depended = $('<ul/>');
        _.map(deps_rev_of_this, function (name) {
            ul_depended.append('<li>' + name + '</li>');
        });
        info.append('<span>Used by:</span>');
        info.append(ul_depended);
    }

    function deactivatePackage() {
        $('#info').html('&nbsp;');
        node.style('fill-opacity', 1);
        node.attr('class', 'node');
    }

    node.on('mouseout', function (d) {
        if (!active_hold) {
            deactivatePackage();
        }
    });

    node.append("title")
        .text(function (d) {
            return d.name;
        });

    force.on("tick", function () {
        link.attr("x1", function (d) {
                return d.source.x;
            })
            .attr("y1", function (d) {
                return d.source.y;
            })
            .attr("x2", function (d) {
                return d.target.x;
            })
            .attr("y2", function (d) {
                return d.target.y;
            });

        node.attr("cx", function (d) {
                return d.x;
            })
            .attr("cy", function (d) {
                return d.y;
            });
    });
});

function addLegend(svg) {
    var g = svg.append('g');
    var width = svg.attr('width');
    var height = svg.attr('height');
    var legend_height = 400;
    g.attr('transform', 'translate(0,' + (height - legend_height) + ')');
    g.append('rect').attr({
        x: 0,
        y: 0,
        width: 150,
        height: legend_height
    }).style('fill', '#eee');

    var depends = [0, 10, 20];
    g.append('text').text('Depends on').attr({x: 10, y: 20}).style({'font-size': 12, 'font-weight': 'bold'});
    g.selectAll('text.depends').data(depends).enter().append('text').text(function (d) {
            return '' + d + ' packages'
        })
        .attr({
            'class': 'depends',
            x: 110,
            y: function (d, i) {
                return i * 30 + 40 + 6;
            },
            'text-anchor': 'end'
        }).style('font-size', 12);
    g.selectAll('circle.depends').data(depends).enter().append('circle').attr({
        cy: function (d, i) {
            return i * 30 + 40;
        },
        cx: 20,
        r: calcSize(20),
        'class': 'node depends'
    }).style({
        fill: function (d) {
            return calcColor(d)
        }
    })

    var section2_offset = 140;
    var sizes = [[0, 0], [20, 30], [60, 70]];
    g.append('text').text('Used by').attr({x: 10, y: section2_offset}).style({'font-size': 12, 'font-weight': 'bold'});
    g.selectAll('text.sizes').data(sizes).enter().append('text').text(function (d) {
            return '' + d[0] + ' packages'
        })
        .attr({
            'class': 'sizes',
            x: 110,
            y: function (d, i) {
                return d[1] + 20 + 6 + section2_offset;
            },
            'text-anchor': 'end'
        }).style('font-size', 12);
    g.selectAll('circle.sizes').data(sizes).enter().append('circle').attr({
        fill: 'blue',
        cy: function (d, i) {
            return d[1] + 20 + section2_offset;
        },
        cx: 20,
        r: function (d) {
            return calcSize(d[0])
        },
        'class': 'node sizes'
    });

    var section3_offset = 270;
    var dependency = ['used', 'using'];
    g.append('text').text('Selected package').attr({x: 10, y: section3_offset}).style({
        'font-size': 12,
        'font-weight': 'bold'
    });
    g.selectAll('text.dependency').data(['depends on','is used by']).enter().append('text').text(function (d) {
            return d;
        })
        .attr({
            'class': 'dependency',
            x: 20,
            y: function (d, i) {
                return i * 30 + 20 + 3 + section3_offset;
            }
        }).style('font-size', 12);
    g.selectAll('circle.dependency').data(dependency).enter().append('circle').attr({
        cy: function (d, i) {
            return i * 30 + 20 + section3_offset;
        },
        cx: 100,
        r: calcSize(20),
        'class': function (d) {
            return 'node ' + d;
        }
    }).style({
        fill: function (d) {
            return calcColor(0)
        }
    });

    svg.append('text').text('Hover on a node to show dependency, click to hold selection.')
        .attr({x: 10, y: 10}).style({
        'font-size': 12,
        'font-weight': 'bold'
    });
    svg.append('text').text('(Click background to clear selection.)')
        .attr({x: 10, y: 25}).style({
        'font-size': 12,
        'font-weight': 'bold'
    });
}