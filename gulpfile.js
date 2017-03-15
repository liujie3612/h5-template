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
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var streamSeries = require('stream-series');
var plumber = require('gulp-plumber');

//new add modules
var fontmin = require('gulp-fontmin');
var rev = require('gulp-rev');
var revReplace = require("gulp-rev-replace");
var htmlminify = require("gulp-html-minify");

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

gulp.task('copy', function() {
    return gulp.src(['app/src/audios/*', 'app/src/fonts/**/*', 'app/src/styles/bundle.css', 'app/src/scripts/bundle.js', 'app/src/index.html'], {
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


gulp.task('contat-css', function() {
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
        .pipe(gulp.dest('app/src/styles'))
});

// bundle CommonJS modules under app/src/javascripts, concat javascripts in the right order,
// and save as app/dist/javascripts/bundle.js
gulp.task('contat-js', function() {
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
        .pipe(gulp.dest('app/src/scripts'))
});



// delete cache
// gulp.task('clean-cache', function (cb) {
//     return cache.clearAll(cb)
// });

// development workflow task
/*gulp.task('dev', function(cb) {
    runSequence(['clean-files'], ['copy'], ['publish-images', 'publish-css', 'publish-js', 'publish-fonts'], ['rev'], 'inject', 'watch', cb);
});*/

gulp.task('dev', function(cb) {
    runSequence(['contat-css', 'contat-js'], 'watch', cb);
});

// default task
gulp.task('default', ['dev']);

// watch files and run corresponding task(s) once files are added, removed or edited.
gulp.task('watch', function() {
    browserSync.init({
        server: {
            baseDir: 'app/src'
        }
    });

    gulp.watch('app/src/scss/**/*.scss', ['contat-css']);
    gulp.watch('app/src/scripts/**/*', ['contat-js']);

    gulp.watch('app/src/index.html').on('change', browserSync.reload);
    // gulp.watch('app/src/scripts/*').on('change', browserSync.reload);
    gulp.watch('app/src/styles/*').on('change', browserSync.reload);
    gulp.watch('app/src/fonts/*').on('change', browserSync.reload);
    gulp.watch('app/src/images/*').on('change', browserSync.reload);
});

/* ============================================================================================================
================================================= For Production ==============================================
=============================================================================================================*/

gulp.task("rev", () => {
    /*version 可随意配置*/
    return gulp.src(['app/dist/styles/*.css', 'app/dist/scripts/*.js', 'app/dist/images/*', 'app/dist/fonts/*', 'app/dist/audios/*'], { base: 'app/dist' })
        .pipe(rev())
        .pipe(gulp.dest('app/dist'))
        .pipe(rev.manifest())
        .pipe(gulp.dest("rev/assets"))
});

gulp.task("revreplace", function() {
    var manifest = gulp.src("rev/**/*.json");
    return gulp.src(["app/dist/scripts/**/*.js", "app/dist/styles/**/*.css", "app/dist/*.html"], {
            base: "app/dist"
        })
        .pipe(revReplace({
            manifest: manifest,
            prefix: 'https://img.wdstatic.cn/test'
        }))
        .pipe(gulp.dest("app/dist"));
});

gulp.task('build-html', function() {
    return gulp.src('app/dist/*.html')
        .pipe(htmlminify())
        .pipe(gulp.dest("app/dist/"))
});

// delete app/dist/styles/bundle.css and app/dist/javascripts/bundle.js
gulp.task('del-bundle', ['revreplace'], function(cb) {
    return del([
        'app/dist/audios/background.mp3',
    ], cb);
});

gulp.task('build', function(cb) {
    runSequence('clean-files', 'copy', ['publish-images', 'publish-fonts'], 'rev', 'revreplace', 'build-html');
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
