'use strict';

var gulp = require('gulp');
var autoprefixer = require('gulp-autoprefixer');
var browserify = require('gulp-browserify');
var browserSync = require('browser-sync').create();
var concat = require('gulp-concat');
var del = require('del');
var inject = require('gulp-inject');
var minifycss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var imagemin = require('gulp-imagemin');
var notify = require('gulp-notify');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var streamSeries = require('stream-series');
var plumber = require('gulp-plumber');


//new add modules
var fontmin = require('gulp-fontmin');
var rev = require('gulp-rev');
var revReplace = require("gulp-rev-replace");

//custom module
var vendors = require('./config/vendors');

/* ============================================================================================================
============================================ For Development ==================================================
=============================================================================================================*/


// delete files under app/dist
gulp.task('clean-files', function(cb) {
    return del([
        'app/dist/**/*', 'rev/**/*'
    ], cb);
});

gulp.task('copy', ['clean-files'], function() {
    return gulp.src(['app/src/audios/*', 'app/src/fonts/**/*'], {
            base: 'app/src'
        })
        .pipe(gulp.dest('app/dist'))
});

// optimize images under app/src/images and save the results to app/dist/images
gulp.task('publish-images', function() {
    var imagesWithoutSVG = ['app/src/images/**/*', '!app/src/images/**/*.svg'];
    var SVGs = 'app/src/images/**/*.svg';
    return streamSeries(
            gulp.src(imagesWithoutSVG)
            .pipe(imagemin({
                optimizationLevel: 5,
                progressive: true,
                interlaced: true
            })),
            gulp.src(SVGs)
        )
        .pipe(gulp.dest('app/dist/images'))
});


gulp.task('publish-fonts', function(done) {
    var buffers = [];
    gulp
        .src(['app/src/*.html'])
        .on('data', function(file) {
            buffers.push(file.contents);
        })
        .on('end', function() {
            var text = Buffer.concat(buffers).toString('utf-8');
            gulp.src('app/src/fonts/fzltxh.ttf')
                .pipe(fontmin({
                    text: text
                }))
                .pipe(gulp.dest('app/dist/fonts'))
                .on('end', done)
        });
})

// compile sass, concat styles in the right order,
// and save as app/dist/styles/bundle.css
gulp.task('publish-css', function() {
    var cssVendors = vendors.styles;
    return streamSeries(
            gulp.src(cssVendors),
            gulp.src('app/src/scss/main.scss')
            .pipe(plumber({
                errorHandler: errorAlert
            }))
            .pipe(sass({
                outputStyle: 'expanded'
            }))
            .pipe(autoprefixer())
        )
        .pipe(concat('bundle.css'))
        .pipe(minifycss())
        .pipe(gulp.dest('app/dist/styles'))
});

// bundle CommonJS modules under app/src/javascripts, concat javascripts in the right order,
// and save as app/dist/javascripts/bundle.js
gulp.task('publish-js', function() {
    var jsVendors = vendors.scripts;
    return streamSeries(
            gulp.src(jsVendors),
            gulp.src('app/src/scripts/main.js')
            .pipe(plumber({
                errorHandler: errorAlert
            }))
            .pipe(browserify({
                transform: ['partialify'],
                debug: true
            }))
        )
        .pipe(concat('bundle.js'))
        .pipe(uglify())
        .pipe(gulp.dest('app/dist/scripts'))
});

// inject app/dist/styles/bundle.css and app/dist/javascripts/bundle.js into app/src/index.html
// and save as app/dist/index.html
gulp.task('inject', function() {
    var target = gulp.src('app/src/index.html')
    var assets = gulp.src([
        'app/dist/styles/bundle.css/',
        'app/dist/scripts/bundle.js/'
    ], {
        read: false
    })
    return target
        .pipe(inject(assets, {
            ignorePath: 'app/dist',
            addRootSlash: true,
            removeTags: true
        }))
        .pipe(gulp.dest('app/dist'));
});

/*version可随意配置*/
gulp.task("rev", () => {
    gulp.src(['app/dist/styles/*.css', 'app/dist/scripts/*.js', 'app/dist/images/*', 'app/dist/fonts/*', 'app/dist/audios/*'], { base: 'app/dist' })
        .pipe(rev())
        .pipe(gulp.dest('app/dist'))
        .pipe(rev.manifest())
        .pipe(gulp.dest("rev/assets"))
});


// watch files and run corresponding task(s) once files are added, removed or edited.
gulp.task('watch', function() {
    browserSync.init({
        server: {
            baseDir: 'app/dist'
        }
    });
    gulp.watch('app/src/index.html', ['inject']);
    gulp.watch('app/src/scss/**/*.scss', ['publish-css']);
    gulp.watch('app/src/scripts/**/*', ['publish-js']);
    gulp.watch('app/src/fonts/**/*', ['publish-fonts']);
    gulp.watch('app/src/images/**/*', ['publish-images']);
    gulp.watch('app/src/audios/**/*', ['publish-audios']);

    gulp.watch('app/dist/index.html').on('change', browserSync.reload);
    gulp.watch('app/dist/scripts/*').on('change', browserSync.reload);
    gulp.watch('app/dist/fonts/*').on('change', browserSync.reload);
    gulp.watch('app/dist/images/*').on('change', browserSync.reload);
});

// delete cache
// gulp.task('clean-cache', function (cb) {
//     return cache.clearAll(cb)
// });

// development workflow task
gulp.task('dev', function(cb) {
    runSequence(['clean-files'], ['copy'], ['publish-images', 'publish-css', 'publish-js', 'publish-fonts'], ['rev'], 'inject', 'watch', cb);
});

// default task
gulp.task('default', ['dev']);

/* ============================================================================================================
================================================= For Production ==============================================
=============================================================================================================*/
// minify app/dist/styles/bundle.css and save as app/dist/styles/bundle.min.css
gulp.task('minify-css', function() {
    return gulp.src('app/dist/styles/bundle.css')
        .pipe(minifycss())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(gulp.dest('app/dist/styles'));
});

// uglify app/dist/javascripts/bundle.js and save as app/dist/javascripts/bundle.min.js
gulp.task('uglify-js', function() {
    return gulp.src('app/dist/scripts/bundle.js')
        .pipe(uglify())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(gulp.dest('app/dist/scripts'));
});

// inject app/dist/styles/bundle.min.css and app/dist/javascripts/bundle.min.js into app/src/index.html
// and save as app/dist/index.html
gulp.task('inject-min', function() {
    var target = gulp.src('app/src/index.html');
    var assets = gulp.src([
        'app/dist/styles/bundle.min.css',
        'app/dist/scripts/bundle.min.js'
    ], {
        read: false
    });
    return target
        .pipe(inject(assets, {
            ignorePath: 'app/dist/',
            addRootSlash: false,
            removeTags: true
        }))
        .pipe(gulp.dest('app/dist'));
});

gulp.task("revreplace", ['publish-images', 'publish-fonts', 'publish-css', 'publish-js'], function() {
    var manifest = gulp.src("rev/**/*.json");
    return gulp.src(["app/dist/scripts/**/*.js", "app/dist/styles/**/*.css", "app/dist/*.html"], { base: "app/dist" })
        .pipe(revReplace({ manifest: manifest, prefix: 'https://img.wdstatic.cn/test' }))
        .pipe(gulp.dest("app/dist"));
});

// delete app/dist/styles/bundle.css and app/dist/javascripts/bundle.js
gulp.task('del-bundle', ['revreplace'], function(cb) {
    return del([
        'app/dist/styles/bundle.css',
        'app/dist/scripts/bundle.js',
        'app/dist/audios/background.mp3'
    ], cb);
});

// delete unminified files
gulp.task('build', function(cb) {
    runSequence('del-bundle', cb);
});

/* ===============================================
 ================== Functions ====================
 ================================================*/

// handle errors
function errorAlert(error) {
    notify.onError({
        title: "Error in plugin '" + error.plugin + "'",
        message: 'Check your terminal',
        sound: 'Sosumi'
    })(error);
    console.log(error.toString());
    this.emit('end');
}
