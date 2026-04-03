#!/bin/sh
# Inject backend URL from Netlify env var into widget config
echo "window.__HTS_SERVER__='${HTS_BACKEND_URL:-}';" > widget/env.js
echo "Build done. HTS_BACKEND_URL=${HTS_BACKEND_URL:-'(not set)'}"
