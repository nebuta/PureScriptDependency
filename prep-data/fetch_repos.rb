require 'open-uri'
require 'json'

def find_deps(name, git_url)
  # s = `bower lookup #{name}`
  git_url =~ /github\.com\/(.+?)(\.git)?$/
  url = "https://raw.githubusercontent.com/%s/master/bower.json" % $1
  puts "#{name}: #{url}"
  begin
    open(url) {|f|
      str = f.read
      json = JSON.parse(str)
      (json['devDependencies'] or {}).merge(json['dependencies']) or {}
    }
  rescue
    puts 'Error.'
    {}
  end
end

def find_deps_recursive(all_deps, url_hash, name)
  return if all_deps.keys.include? name

  deps = find_deps(name, url_hash[name])
  all_deps[name] = deps
  deps.keys.map{|n|
    unless all_deps.keys.include? n
      find_deps_recursive(all_deps,url_hash,n)
    end
  }
end

ps = open('https://bower.herokuapp.com/packages') {|f|
  JSON.parse(f.read)
}
all_deps = {}
packages = {}
ps.select{|package|
  package['name'].index('purescript-') == 0
}.map{|package|
  name = package['name']
  url = package['url']
  packages[name] = url
}
  packages.keys.map{|name|
  find_deps_recursive(all_deps,packages,name)
}
IO.write('purescript-packages.json', JSON.pretty_generate(all_deps))
