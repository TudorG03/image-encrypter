package eu.deic.ism.service;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import eu.deic.ism.client.C05ApiClient;
import eu.deic.ism.dto.AuthResponse;
import eu.deic.ism.dto.LoginRequest;
import eu.deic.ism.dto.RegisterRequest;
import eu.deic.ism.security.JwtUtil;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private BCryptPasswordEncoder passwordEncoder;

    private C05ApiClient c05ApiClient;

    private JwtUtil jwtUtil;

    public AuthService(BCryptPasswordEncoder passwordEncoder, C05ApiClient c05ApiClient, JwtUtil jwtUtil) {
        this.passwordEncoder = passwordEncoder;
        this.c05ApiClient = c05ApiClient;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse register(RegisterRequest request) {
        Map<String, Object> existingUser = c05ApiClient.getUserByUsername(request.username());
        if (existingUser != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken!");
        }

        String hashedPassword = passwordEncoder.encode(request.password());
        c05ApiClient.createUser(request.username(), hashedPassword);

        return new AuthResponse(jwtUtil.generateToken(request.username()));
    }

    public AuthResponse login(LoginRequest request) {
        Map<String, Object> existingUser = c05ApiClient.getUserByUsername(request.username());
        if (existingUser == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Username doesn't exist!");
        }

        if (!passwordEncoder.matches(request.password(), (String) existingUser.get("passwordHash"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong password provided!");
        }

        return new AuthResponse(jwtUtil.generateToken(request.username()));
    }
}
