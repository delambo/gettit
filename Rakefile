require 'rubygems'
require 'jammit'

# Usage (with version parameter):
#   rake build[0.5.0]

# Think before you change - this directory is removed!!!
BUILDDIR = "build"

desc "minify gettit source with jammit; build the docs; package the build"
task :build, [:version] do |t, args|

	puts "Building version #{args.version} to #{BUILDDIR}/"

	FileUtils.rm_rf BUILDDIR, :verbose => true

	Jammit.package!({
		:config_path   => "assets.yml",
		:output_folder => BUILDDIR
	})
	
	# Copy the license to the top of the minified files.
	FileUtils.cp "gettit.js", BUILDDIR
	copy_license "gettit.js", BUILDDIR + "/gettit.js"
	copy_license BUILDDIR + '/gettit.min.js', BUILDDIR + '/gettit.min.js'

	# Create the docs.
	system "mkdir -p #{BUILDDIR}/docs/annotated"
	system "rocco #{BUILDDIR}/gettit.js"
	system "mv #{BUILDDIR}/gettit.html #{BUILDDIR}/docs/annotated/index.html"

	# Zip it all up.
	system "zip -r #{BUILDDIR}/gettit_#{args.version}.zip #{BUILDDIR}"
end

def copy_license(from, to)
	File.open(BUILDDIR + "/temp.js","w") do |tempfile|
		tempfile.puts File.read("LICENSE.js")
		tempfile.puts File.read(from)
	end
	FileUtils.mv BUILDDIR + "/temp.js", to
end
