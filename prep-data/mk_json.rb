# Make a JSON file for D3.js

require 'json'

obj = JSON.parse(IO.read('purescript-packages.json'))
list = obj.map{|k,v|
  v.map{|k2,v2|
    [k2,k]
  }
}.flatten(1)

list_used = list.map{|a| a[0]}

names = list.flatten.uniq

nodes = names.map{|n| {:name => n, :used_count => list_used.count(n), :using_count => obj[n].keys.length}}

links = list.map{|a|
  factor = list_used.count(a[0]) * list_used.count(a[1]) + 1
  {:source => names.index(a[0]), :target => names.index(a[1]), :factor => factor}
}

IO.write('list.json', JSON.pretty_generate({:nodes => nodes, :links => links}))
