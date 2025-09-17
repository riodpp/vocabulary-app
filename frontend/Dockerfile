FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Accept build-time environment variables
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

# Process config template with environment variables
COPY --from=build /app/public/config.template.js /tmp/config.template.js
RUN envsubst '${REACT_APP_SUPABASE_URL} ${REACT_APP_SUPABASE_ANON_KEY}' < /tmp/config.template.js > /usr/share/nginx/html/config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]